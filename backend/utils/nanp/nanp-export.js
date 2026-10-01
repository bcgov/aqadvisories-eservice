/*
 * Exports every sms subscription as CSV, classified against the NANP rules,
 * so the deletion candidates can be reviewed in a spreadsheet. READ ONLY.
 *
 * Columns: id,classification,stored,digits,digitCount,state,serviceName,created,reason
 *
 * classification is one of:
 *   valid        already ###-###-####, keep as is
 *   reformat     a real NANP number in another format, rewrite it
 *   duplicate    reformats onto a number already subscribed, remove
 *   invalid      not a NANP number, remove
 *
 * Must be run as a script FILE, not piped to an interactive shell:
 *
 *   POD=$(oc -n ef3999-prod get pod -l deploymentconfig=mongodb2 \
 *           -o jsonpath='{.items[0].metadata.name}')
 *
 *   oc -n ef3999-prod exec -i "$POD" -- bash -c \
 *     'cat > /tmp/nanp-export.js && mongo -u "$MONGODB_USER" -p "$MONGODB_PASSWORD" \
 *        "$MONGODB_DATABASE" --quiet /tmp/nanp-export.js' \
 *     < utils/nanp/nanp-export.js > sms-subscriptions.csv
 *
 * Written in ES5 for compatibility with the legacy `mongo` shell.
 */

var NANP_CANONICAL = /^[2-9][0-9]{2}-[2-9][0-9]{2}-[0-9]{4}$/;
var NANP_DIGITS = /^[2-9][0-9]{2}[2-9][0-9]{6}$/;

function digitsOf(value) {
  if (typeof value !== 'string') {
    return '';
  }
  var d = value.replace(/[^0-9]/g, '');
  if (d.length === 11 && d.charAt(0) === '1') {
    d = d.substring(1);
  }
  return d;
}

function toCanonical(d) {
  return d.substring(0, 3) + '-' + d.substring(3, 6) + '-' + d.substring(6);
}

function reasonFor(value) {
  if (typeof value !== 'string' || value === '') {
    return 'empty or non-string value';
  }
  var d = digitsOf(value);
  if (d.length !== 10) {
    return 'has ' + d.length + ' digits, needs 10';
  }
  var r = [];
  if (/^[01]/.test(d)) {
    r.push('area code starts with ' + d.charAt(0));
  }
  if (/^[01]/.test(d.substring(3))) {
    r.push('exchange code starts with ' + d.charAt(3));
  }
  return r.length ? r.join('; ') : 'fails NANP pattern';
}

// String(ObjectId) renders as ObjectId("...") in the shell, which is noise in a
// CSV cell. valueOf() gives the bare hex, and is a harmless no-op for the
// string or numeric _ids that older records may carry.
function idOf(id) {
  if (id === null || id === undefined) {
    return '';
  }
  return typeof id.valueOf === 'function' ? String(id.valueOf()) : String(id);
}

function csv(v) {
  var s = v === undefined || v === null ? '' : String(v);
  return '"' + s.replace(/"/g, '""') + '"';
}

// Pass 1: classify. Canonical numbers are recorded so pass 2 can tell a
// reformat apart from a duplicate.
var seen = {};
var rows = [];
var scannedBefore = db.subscription.count({});

var cursor = db.subscription
  .find({}, { userChannelId: 1, channel: 1, state: 1, serviceName: 1, created: 1 })
  .batchSize(500);
cursor.addOption(16); // noTimeout

var scanned = 0;
while (cursor.hasNext()) {
  var doc = cursor.next();
  scanned++;
  if (doc.channel !== 'sms') {
    continue;
  }
  var raw = doc.userChannelId;
  var d = digitsOf(raw);
  var row = {
    id: idOf(doc._id),
    stored: raw === undefined ? '' : String(raw),
    digits: d,
    digitCount: d.length,
    state: doc.state || '',
    serviceName: doc.serviceName || '',
    created: doc.created ? new Date(doc.created).toISOString() : '',
  };

  if (typeof raw === 'string' && NANP_CANONICAL.test(raw)) {
    row.classification = 'valid';
    row.reason = '';
    seen[row.serviceName + '|' + raw] = true;
  } else if (NANP_DIGITS.test(d)) {
    row.classification = 'reformat';
    row.canonical = toCanonical(d);
    row.reason = '';
  } else {
    row.classification = 'invalid';
    row.reason = reasonFor(raw);
  }
  rows.push(row);
}

var scannedAfter = db.subscription.count({});
if (scanned < Math.min(scannedBefore, scannedAfter)) {
  throw new Error(
    'incomplete scan: ' + scanned + ' of at least ' +
      Math.min(scannedBefore, scannedAfter) + ' documents -- do not use this export'
  );
}

// Pass 2: a reformat whose canonical form already exists is really a duplicate.
for (var i = 0; i < rows.length; i++) {
  if (rows[i].classification !== 'reformat') {
    continue;
  }
  var key = rows[i].serviceName + '|' + rows[i].canonical;
  if (seen[key]) {
    rows[i].classification = 'duplicate';
    rows[i].reason = 'already subscribed as ' + rows[i].canonical;
  } else {
    seen[key] = true;
  }
}

print(
  'id,classification,stored,digits,digitCount,state,serviceName,created,reason'
);
for (var j = 0; j < rows.length; j++) {
  var r = rows[j];
  print(
    [
      csv(r.id),
      csv(r.classification),
      csv(r.stored),
      csv(r.digits),
      csv(r.digitCount),
      csv(r.state),
      csv(r.serviceName),
      csv(r.created),
      csv(r.reason),
    ].join(',')
  );
}
