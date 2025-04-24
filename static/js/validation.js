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
    checked = $('input[type=checkbox]:checked').length
    if (!checked) {
      alert('You must subscribe to at least one notification list.')
      return false
    }
    return true
  })
  $('#myForm').submit(function(event) {
    event.preventDefault()
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
