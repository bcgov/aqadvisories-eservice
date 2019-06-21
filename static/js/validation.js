//form validation

//match email
function check(input) {
    if (input.value != document.getElementById('InputEmail').value) {
        input.setCustomValidity('The email address must match.');
    } else {
        // input is valid -- reset the error message
        input.setCustomValidity('');
    }
}
// checkbox minimum selected
$(document).ready(function () {
    $('#checkBtn').click(function () {
        checked = $("input[type=checkbox]:checked").length;

        if (!checked) {
            alert("You must subscribe to at least one notification list.");
            return false;
        }

    });
});
// select all air quality advisories
$(document).ready(function () {
    $("#selectAll").click(function () {
        $(".aqa").prop('checked', $(this).prop('checked'));
    });

    $(".aqa").change(function () {
        if (!$(this).prop("checked")) {
            $("#selectAll").prop("checked", false);
        }
    });
});
// select all smoky skie bulletin
$(document).ready(function () {
    $("#selectAll2").click(function () {
        $(".skb").prop('checked', $(this).prop('checked'));
    });

    $(".skb").change(function () {
        if (!$(this).prop("checked")) {
            $("#selectAll2").prop("checked", false);
        }
    });
});

$(document).ready(function () {
    $(".reset-btn").click(function () {
        $("#myForm").trigger("reset");
    });
});