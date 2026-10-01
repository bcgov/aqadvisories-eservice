/*
 * NANP cleanup for SMS subscriptions.
 *
 * Run utils/nanp/nanp-audit.js FIRST and review its two lists. This script
 * applies the changes:
 *
 *   NORMALIZE  rewrites real NANP numbers stored in a non-canonical format
 *              (+1, brackets, spaces, no dashes) to ###-###-####
 *   APPLY      hard-deletes subscriptions whose number cannot be a NANP number
 *
 * Both default to OFF -- with no flags this is a dry run that reports exactly
 * what it would do and changes nothing.
 *
 * Dry run:
 *
 *   oc -n ef3999-prod rsh mongodb2-5-r4r4s bash -c \
 *     'mongo -u "$MONGODB_USER" -p "$MONGODB_PASSWORD" "$MONGODB_DATABASE" --quiet' \
 *     < utils/nanp/nanp-cleanup.js
 *
 * For real (flags are prepended to the piped script). Keep the output --
 * every deleted document is printed in full as a backup before removal:
 *
 *   { echo 'var NORMALIZE=true; var APPLY=true;'; cat utils/nanp/nanp-cleanup.js; } \
 *     | oc -n ef3999-prod rsh mongodb2-5-r4r4s bash -c \
 *       'mongo -u "$MONGODB_USER" -p "$MONGODB_PASSWORD" "$MONGODB_DATABASE" --quiet' \
 *     | tee nanp-cleanup-$(date +%Y%m%d-%H%M%S).log
 *
 * Written in ES5 for compatibility with the legacy `mongo` shell.
 */

var DO_NORMALIZE = typeof NORMALIZE !== 'undefined' && NORMALIZE === true;
var DO_DELETE = typeof APPLY !== 'undefined' && APPLY === true;

// ---------------------------------------------------------------- NANP rules
// Keep in sync with utils/nanp/nanp-audit.js, aqadvisories-eservice/index.js
// and common/models/subscription.js.

var NANP_CANONICAL = /^[2-9][0-9]{2}-[2-9][0-9]{2}-[0-9]{4}$/;
var NANP_DIGITS = /^[2-9][0-9]{2}[2-9][0-9]{6}$/;

function toNanpDigits(value) {
  if (typeof value !== 'string') {
    return null;
  }
  var digits = value.replace(/[^0-9]/g, '');
  if (digits.length === 11 && digits.charAt(0) === '1') {
    digits = digits.substring(1);
  }
  return NANP_DIGITS.test(digits) ? digits : null;
}

function toCanonical(digits) {
  return (
    digits.substring(0, 3) + '-' + digits.substring(3, 6) + '-' + digits.substring(6)
  );
}

// ------------------------------------------------------------------- scan

var cursor = db.subscription.find({ channel: 'sms' });

var toNormalize = []; // real numbers in the wrong format
var toCollapse = []; // real numbers whose canonical form already exists -> delete as duplicate
var toDelete = []; // not NANP numbers at all
var okCount = 0;
var total = 0;

// canonical values already present, per service, so normalizing cannot create
// a duplicate subscription that would double-send notifications
var seen = {};
var preScan = db.subscription.find({ channel: 'sms' });
while (preScan.hasNext()) {
  var p = preScan.next();
  if (typeof p.userChannelId === 'string' && NANP_CANONICAL.test(p.userChannelId)) {
    seen[(p.serviceName || '') + '|' + p.userChannelId] = true;
  }
}

while (cursor.hasNext()) {
  var doc = cursor.next();
  total++;

  var raw = doc.userChannelId;
  if (typeof raw === 'string' && NANP_CANONICAL.test(raw)) {
    okCount++;
    continue;
  }

  var digits = toNanpDigits(raw);
  if (digits) {
    var canonical = toCanonical(digits);
    var key = (doc.serviceName || '') + '|' + canonical;
    if (seen[key]) {
      doc._canonical = canonical;
      toCollapse.push(doc);
    } else {
      seen[key] = true;
      doc._canonical = canonical;
      toNormalize.push(doc);
    }
  } else {
    toDelete.push(doc);
  }
}

// ------------------------------------------------------------------ report

print('');
print('=========================================================================');
print('  NANP cleanup  --  database: ' + db.getName());
print('  normalize: ' + (DO_NORMALIZE ? 'ON' : 'OFF (dry run)'));
print('  delete:    ' + (DO_DELETE ? 'ON' : 'OFF (dry run)'));
print('=========================================================================');
print('');
print('  total sms subscriptions ......... ' + total);
print('  already valid ................... ' + okCount);
print('  to reformat ..................... ' + toNormalize.length);
print('  to delete as duplicate .......... ' + toCollapse.length);
print('  to delete as invalid ............ ' + toDelete.length);
print('');

// ---------------------------------------------------------------- normalize

print('-------------------------------------------------------------------------');
print('  REFORMAT  (' + toNormalize.length + ')');
print('-------------------------------------------------------------------------');
var normalized = 0;
for (var i = 0; i < toNormalize.length; i++) {
  var n = toNormalize[i];
  print('  ' + n.userChannelId + '  ->  ' + n._canonical + '   [' + n.state + ']  ' + n._id);
  if (DO_NORMALIZE) {
    db.subscription.updateOne(
      { _id: n._id },
      { $set: { userChannelId: n._canonical, updated: new Date() } }
    );
    normalized++;
  }
}
if (toNormalize.length === 0) {
  print('  (none)');
}
print('');

// ------------------------------------------------------------------ delete
// Every document is printed in full before removal -- this output IS the backup.

print('-------------------------------------------------------------------------');
print('  DELETE AS DUPLICATE  (' + toCollapse.length + ')');
print('  Same number, same service, already present in canonical form.');
print('-------------------------------------------------------------------------');
var deletedDupes = 0;
for (var j = 0; j < toCollapse.length; j++) {
  var d = toCollapse[j];
  print('  --- backup ---');
  delete d._canonical; // script-added, never stored
  printjson(d);
  if (DO_DELETE) {
    db.subscription.deleteOne({ _id: d._id });
    deletedDupes++;
  }
}
if (toCollapse.length === 0) {
  print('  (none)');
}
print('');

print('-------------------------------------------------------------------------');
print('  DELETE AS INVALID  (' + toDelete.length + ')');
print('-------------------------------------------------------------------------');
var deletedInvalid = 0;
for (var k = 0; k < toDelete.length; k++) {
  var x = toDelete[k];
  print('  --- backup ---');
  printjson(x);
  if (DO_DELETE) {
    db.subscription.deleteOne({ _id: x._id });
    deletedInvalid++;
  }
}
if (toDelete.length === 0) {
  print('  (none)');
}
print('');

// ----------------------------------------------------------------- summary

print('=========================================================================');
if (!DO_NORMALIZE && !DO_DELETE) {
  print('  DRY RUN -- nothing was changed.');
  print('  Re-run with: var NORMALIZE=true; var APPLY=true;');
} else {
  print('  reformatted ..................... ' + normalized);
  print('  deleted as duplicate ............ ' + deletedDupes);
  print('  deleted as invalid .............. ' + deletedInvalid);
  var remaining = db.subscription.count({ channel: 'sms' });
  print('  sms subscriptions remaining ..... ' + remaining);
}
print('=========================================================================');
print('');
