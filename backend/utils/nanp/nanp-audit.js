/*
 * NANP audit for SMS subscriptions -- READ ONLY, makes no changes.
 *
 * Classifies every channel:'sms' subscription against the NANP rules:
 *   - 10 digits
 *   - 1st digit (area code) must be 2-9
 *   - 4th digit (central office code) must be 2-9
 *   - all other digits 0-9
 *
 * Run against the mongo pod. The script MUST reach mongo as a file argument,
 * not on stdin: a piped script is treated as interactive input and evaluated
 * line by line, which breaks on block comments and loses variable scope. So
 * write it into the pod first, then run it:
 *
 *   POD=$(oc -n ef3999-prod get pod -l deploymentconfig=mongodb2 \
 *           -o jsonpath='{.items[0].metadata.name}')
 *
 *   oc -n ef3999-prod exec -i "$POD" -- bash -c \
 *     'cat > /tmp/nanp-audit.js && mongo -u "$MONGODB_USER" -p "$MONGODB_PASSWORD" \
 *        "$MONGODB_DATABASE" --quiet /tmp/nanp-audit.js' \
 *     < utils/nanp/nanp-audit.js > nanp-audit.txt
 *
 * Options are set by prepending assignments to the file, e.g.
 *   { echo 'var MAX_ROWS=100000;'; cat utils/nanp/nanp-audit.js; } | oc ... exec ...
 *
 * If the report says SCAN INCOMPLETE, do not use its numbers.
 *
 * Written in ES5 for compatibility with the legacy `mongo` shell.
 */

// ---------------------------------------------------------------- NANP rules

var NANP_CANONICAL = /^[2-9][0-9]{2}-[2-9][0-9]{2}-[0-9]{4}$/; // stored form
var NANP_DIGITS = /^[2-9][0-9]{2}[2-9][0-9]{6}$/; // bare 10 digits

// Reduce a stored value to its 10 NANP digits, or return null if it can't be one.
function toNanpDigits(value) {
  if (typeof value !== 'string') {
    return null;
  }
  var digits = value.replace(/[^0-9]/g, '');
  // tolerate a country code: 1-604-210-9276, +16042109276, 16042109276
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

// Explain, in plain language, why a value is not a NANP number.
function explain(value) {
  if (typeof value !== 'string' || value === '') {
    return 'empty or non-string value';
  }
  var digits = value.replace(/[^0-9]/g, '');
  if (digits.length === 11 && digits.charAt(0) === '1') {
    digits = digits.substring(1);
  }
  if (digits.length !== 10) {
    return 'has ' + digits.length + ' digits, needs 10';
  }
  var reasons = [];
  if (/^[01]/.test(digits)) {
    reasons.push('area code starts with ' + digits.charAt(0));
  }
  if (/^[01]/.test(digits.substring(3))) {
    reasons.push('exchange code starts with ' + digits.charAt(3));
  }
  return reasons.length ? reasons.join('; ') : 'fails NANP pattern';
}

// ------------------------------------------------------------------- scan
//
// This collection is large (280k+ docs) and the mongo pod runs under a 1Gi
// memory limit, so a plain find() over every sms document will OOM-kill the
// pod. Instead page through the _id index in bounded batches: each query does
// a fixed amount of index and fetch work, and the projection keeps the
// returned documents tiny. Only offenders are retained in memory.

var BATCH = typeof BATCH_SIZE !== 'undefined' ? BATCH_SIZE : 1000;
var PAUSE_EVERY = 25; // batches between short pauses, to let the cache settle
var PAUSE_MS = 250;
var MAX_LISTED = typeof MAX_ROWS !== 'undefined' ? MAX_ROWS : 5000;

var PROJECTION = {
  userChannelId: 1,
  channel: 1,
  state: 1,
  serviceName: 1,
  created: 1,
};

var counts = { scanned: 0, total: 0, ok: 0, normalizable: 0, duplicate: 0, invalid: 0 };
var normalizable = [];
var duplicate = [];
var invalid = [];
var truncated = false;

// Canonical numbers already seen, so a value that would merely be reformatted
// onto an existing subscription is reported as a duplicate rather than a
// reformat. Built during the same pass; a collision found before its canonical
// twin is resolved by the second pass below.
var seen = {};
var pending = [];

// Recorded up front so the scan can prove it saw the whole collection. If
// mongod is killed mid-scan the cursor simply returns empty, which is
// indistinguishable from "end of data" -- without this check the report would
// silently understate the problem, or claim a clean collection.
var expectedTotal = db.subscription.count({});

// Stream the collection with one cursor rather than paging on _id. batchSize
// bounds how much the server sends at a time, so shell memory stays flat over
// a 280k-document collection; noTimeout keeps the cursor alive for the whole
// scan. Paging on {_id: {$gt: last}} would also work, but only if every _id
// shares one BSON type -- MongoDB's range operators are type-bracketed, so a
// single odd id would silently end the scan early. Streaming has no such edge.
var cursor = db.subscription.find({}, PROJECTION).batchSize(BATCH);
cursor.addOption(16); // DBQuery.Option.noTimeout

var batches = 0;

while (cursor.hasNext()) {
  {
    var doc = cursor.next();
    counts.scanned++;
    if (doc.channel !== 'sms') {
      continue;
    }
    counts.total++;

    var raw = doc.userChannelId;
    if (typeof raw === 'string' && NANP_CANONICAL.test(raw)) {
      counts.ok++;
      seen[(doc.serviceName || '') + '|' + raw] = true;
      continue;
    }

    var digits = toNanpDigits(raw);
    var row = {
      id: String(doc._id),
      state: doc.state || '(none)',
      service: doc.serviceName || '(none)',
      created: doc.created
        ? new Date(doc.created).toISOString().substring(0, 10)
        : '',
      stored: raw === undefined ? '(missing)' : String(raw),
    };

    if (digits) {
      row.becomes = toCanonical(digits);
      pending.push(row);
    } else {
      counts.invalid++;
      row.reason = explain(raw);
      if (invalid.length < MAX_LISTED) {
        invalid.push(row);
      } else {
        truncated = true;
      }
    }
  }

  if (counts.scanned % (BATCH * PAUSE_EVERY) === 0) {
    batches++;
    print('  ... scanned ' + counts.scanned + ' documents');
    sleep(PAUSE_MS);
  }
}

// Refuse to report numbers that were never fully gathered. The collection is
// live, so the count moves while the scan runs and an exact match is not the
// bar: seeing at least as many documents as the smaller of the before/after
// counts means nothing was skipped. Seeing more is normal -- new subscriptions
// arrive mid-scan, and a non-snapshot cursor can re-return a document that was
// updated while the scan was in flight.
var expectedAfter = db.subscription.count({});
var expectedFloor = Math.min(expectedTotal, expectedAfter);
if (counts.scanned < expectedFloor) {
  print('');
  print('#########################################################################');
  print('  SCAN INCOMPLETE -- RESULTS BELOW ARE NOT USABLE');
  print('');
  print(
    '  collection held ' + expectedTotal + ' documents at the start and ' +
      expectedAfter + ' at the end; only ' + counts.scanned + ' were scanned.'
  );
  print('');
  print('  The scan ended early. Usual causes, in order of likelihood:');
  print('    1. This script was piped into an INTERACTIVE mongo shell, which');
  print('       evaluates line by line and breaks on block comments. Always');
  print('       run it as a script FILE argument (see the header comment).');
  print('    2. mongod was OOM-killed mid-scan; check:');
  print('       oc get pod <pod> -o jsonpath=\'{.status.containerStatuses[0].lastState.terminated.reason}\'');
  print('    3. The cursor timed out.');
  print('');
  print('  Do NOT delete anything based on this run.');
  print('#########################################################################');
  print('');
  throw new Error(
    'incomplete scan: ' + counts.scanned + ' of at least ' + expectedFloor + ' documents'
  );
}

// Second pass over the (small) set of reformattable rows, now that every
// canonical number in the collection is known.
for (var j = 0; j < pending.length; j++) {
  var r = pending[j];
  var key = r.service + '|' + r.becomes;
  if (seen[key]) {
    counts.duplicate++;
    if (duplicate.length < MAX_LISTED) {
      duplicate.push(r);
    } else {
      truncated = true;
    }
  } else {
    seen[key] = true;
    counts.normalizable++;
    if (normalizable.length < MAX_LISTED) {
      normalizable.push(r);
    } else {
      truncated = true;
    }
  }
}

// ----------------------------------------------------------------- report

function pad(s, n) {
  s = String(s);
  while (s.length < n) {
    s = s + ' ';
  }
  return s;
}

function byState(rows) {
  var tally = {};
  for (var i = 0; i < rows.length; i++) {
    tally[rows[i].state] = (tally[rows[i].state] || 0) + 1;
  }
  var parts = [];
  for (var k in tally) {
    parts.push(k + '=' + tally[k]);
  }
  return parts.length ? parts.join(', ') : 'none';
}

print('');
print('=========================================================================');
print('  NANP audit of SMS subscriptions  (read only -- nothing was changed)');
print('  database: ' + db.getName());
print('=========================================================================');
print('');
print('  documents scanned ............... ' + counts.scanned);
print('  total sms subscriptions ......... ' + counts.total);
print('  already valid (###-###-####) .... ' + counts.ok);
print('  valid number, wrong format ...... ' + counts.normalizable + '   -> can be reformatted, keeps subscriber');
print('  duplicate once reformatted ...... ' + counts.duplicate + '   -> same number already subscribed');
print('  not a NANP number ............... ' + counts.invalid + '   -> candidates for deletion');
print('');

print('-------------------------------------------------------------------------');
print('  B. VALID NUMBER, WRONG FORMAT  (' + counts.normalizable + ')');
print('     Real NANP numbers stored with a country code, spaces, brackets etc.');
print('     Recommend reformatting these rather than deleting.');
print('     by state: ' + byState(normalizable));
print('-------------------------------------------------------------------------');
if (normalizable.length === 0) {
  print('  (none)');
} else {
  print(
    '  ' + pad('stored', 24) + pad('becomes', 16) + pad('state', 13) + pad('created', 12) + 'id'
  );
  for (var i = 0; i < normalizable.length; i++) {
    var n = normalizable[i];
    print(
      '  ' + pad(n.stored, 24) + pad(n.becomes, 16) + pad(n.state, 13) + pad(n.created, 12) + n.id
    );
  }
}
print('');

print('-------------------------------------------------------------------------');
print('  C. DUPLICATE ONCE REFORMATTED  (' + counts.duplicate + ')');
print('     The same number is already subscribed to the same service in');
print('     canonical form. Reformatting would double-send, so these are');
print('     removed rather than reformatted.');
print('     by state: ' + byState(duplicate));
print('-------------------------------------------------------------------------');
if (duplicate.length === 0) {
  print('  (none)');
} else {
  print(
    '  ' + pad('stored', 24) + pad('duplicate of', 16) + pad('state', 13) + pad('created', 12) + 'id'
  );
  for (var d = 0; d < duplicate.length; d++) {
    var dup = duplicate[d];
    print(
      '  ' + pad(dup.stored, 24) + pad(dup.becomes, 16) + pad(dup.state, 13) + pad(dup.created, 12) + dup.id
    );
  }
}
print('');

print('-------------------------------------------------------------------------');
print('  D. NOT A NANP NUMBER  (' + counts.invalid + ')');
print('     These cannot be dialled. Deleting them is the proposed action.');
print('     by state: ' + byState(invalid));
print('-------------------------------------------------------------------------');
if (invalid.length === 0) {
  print('  (none)');
} else {
  print(
    '  ' + pad('stored', 24) + pad('state', 13) + pad('created', 12) + pad('reason', 34) + 'id'
  );
  for (var invalidIdx = 0; invalidIdx < invalid.length; invalidIdx++) {
    var v = invalid[invalidIdx];
    print(
      '  ' + pad(v.stored, 24) + pad(v.state, 13) + pad(v.created, 12) + pad(v.reason, 34) + v.id
    );
  }
}
print('');
print('=========================================================================');
if (truncated) {
  print('  NOTE: counts above are exact, but the listings were capped at ' + MAX_LISTED);
  print('  rows each. Re-run with: var MAX_ROWS=50000; to list everything.');
  print('');
}
print('  Nothing has been modified. Review lists B, C and D above, then run');
print('  utils/nanp/nanp-cleanup.js to apply changes.');
print('=========================================================================');
print('');
