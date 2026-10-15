// NANP (North American Numbering Plan) rules for sms numbers:
// 10 digits, area code and central office code must both start with 2-9.
//
// Loaded twice, from one source, so the form and the endpoint cannot drift:
//   - the browser, via <script src="./js/nanp.js"> in subscription.html
//   - the Express server, via require('./static/js/nanp') in index.js
//
// notify-bc keeps its own copy of this rule in common/models/subscription.js.
// It is a separate deployable with no shared package, so that duplication is
// deliberate -- change both together.
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.nanp = factory()
  }
})(typeof self !== 'undefined' ? self : this, function () {
  var NANP_DIGITS = /^[2-9]\d{2}[2-9]\d{6}$/

  // Returns the number in canonical ###-###-#### form, or null if it is not a
  // valid NANP number. A leading country code of 1 and any separators are
  // tolerated on input, but the canonical form is what gets stored.
  function normalize(value) {
    if (typeof value !== 'string') {
      return null
    }
    var digits = value.replace(/[^0-9]/g, '')
    if (digits.length === 11 && digits.charAt(0) === '1') {
      digits = digits.substring(1)
    }
    if (!NANP_DIGITS.test(digits)) {
      return null
    }
    return (
      digits.substring(0, 3) +
      '-' +
      digits.substring(3, 6) +
      '-' +
      digits.substring(6)
    )
  }

  function isValid(value) {
    return normalize(value) !== null
  }

  return { normalize: normalize, isValid: isValid }
})
