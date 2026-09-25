// select all air quality advisories
$(document).ready(function() {
  $('#selectAll').click(function() {
    $('.aqa').prop('checked', $(this).prop('checked'))
  })

  $('.aqa').change(function() {
    if (!$(this).prop('checked')) {
      $('#selectAll').prop('checked', false)
    }
  })
})
// select all smoky skies bulletin
$(document).ready(function() {
  $('#selectAll2').click(function() {
    $('.skb').prop('checked', $(this).prop('checked'))
  })

  $('.skb').change(function() {
    if (!$(this).prop('checked')) {
      $('#selectAll2').prop('checked', false)
    }
  })
})

$(document).ready(function() {
  $('.reset-btn').click(function() {
    $('#myForm').trigger('reset')
  })
})

///FORM VALIDATION

// The form is submitted natively further down (see the reCAPTCHA handler), and
// a native submit skips the browser's own constraint validation. So the phone
// pattern has to be re-checked here or it is never enforced.
// nanp is provided by js/nanp.js, which the server requires as well.
function validatePhoneField() {
  var phone = $.trim($('#InputPhone').val())
  // the input mask can leave a stray separator behind when the field is cleared
  if (!/[0-9]/.test(phone)) {
    return true
  }
  if (!nanp.isValid(phone)) {
    alert(
      'Please enter a valid 10-digit mobile phone number in the format ###-###-####.\n\n' +
        'Do not include the country code. The area code and the next three digits must each start with a number from 2 to 9.'
    )
    $('#InputPhone').focus()
    return false
  }
  if (!$('#InputSmsConsent').prop('checked')) {
    alert(
      'To receive SMS text messages, you must check the box agreeing to receive them.'
    )
    $('#InputSmsConsent').focus()
    return false
  }
  return true
}

// fields checkbox minimum selected
$(document).ready(function() {
$('#checkBtn').click(function() {
   if (myForm.userChannelId.value == ""
	&& myForm.phone.value == "") {
alert( 'You need to fill out at least your email address or a mobile phone number to subscribe' );
     return false;
    } 
  })      
  $('#checkBtn').click(function() {
    // the SMS consent box is not a notification list, so it doesn't count here
    checked = $('input[type=checkbox]:checked').not('#InputSmsConsent').length
    if (!checked) {
      alert('You must subscribe to at least one notification list.')
      return false
    }
    return true
  })
  $('#myForm').submit(function(event) {
    event.preventDefault()
    if (!validatePhoneField()) {
      return false
    }
    if (
      !confirm(
        'Please confirm: do you want to subscribe to these notification lists?'
      )
    ) {
      return false
    }
    grecaptcha.ready(function() {
      grecaptcha
        .execute('6LeOitcUAAAAAIdx7rI5W27QySOqaML-qrlzuYhN', {
          action: 'submit'
        })
        .then(function(token) {
          $('#token').val(token)
          $('#myForm').off('submit')
          $('#myForm').submit()
        })
    })
    return false
  })
})
