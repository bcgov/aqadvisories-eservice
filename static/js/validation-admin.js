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
// select all smoky skies bulletin
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

///FORM VALIDATION

// checkbox minimum selected
$(document).ready(function () {
    $('#checkBtn').click(function () {
        checked = $("[name=city]:checked").length > 0;
        if (!checked) {
            alert("You must select at least one notification list.");
            return false;
        } else {
            return confirm('Please confirm: do you want to post to these notifcation lists?');
        }

    });
});