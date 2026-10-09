async function handleResubscribe(subscriptionId, unsubscriptionCode) {
  const messageDiv = document.getElementById('message');
  try {
    const apiUrl = `${window.location.origin}/resubscribe/${subscriptionId}/${unsubscriptionCode}`;
    const response = await fetch(apiUrl, {
      method: 'GET',
    });

    if (response.ok) {
      window.location.href = `/re_subscribed.html?channel=email`;
    } else {
      const errorData = await response.json();
      console.error("Backend resubscription failed:", errorData);
      messageDiv.innerHTML = `<div class="alert alert-danger">Error: Could not resubscribe. Please try again later.</div>`;
    }
  } catch (error) {
    console.error("Error calling backend for resubscription:", error);
    messageDiv.innerHTML = '<div class="alert alert-danger">Error: Could not reach the server to resubscribe. Please check your connection and try again.</div>';
  }
}

function initiateResubscribe() {
  const urlParams = new URLSearchParams(window.location.search);
  const subscriptionId = urlParams.get('subscriptionId');
  const unsubscriptionCode = urlParams.get('unsubscriptionCode');
  const messageDiv = document.getElementById('message');

  if (subscriptionId && unsubscriptionCode) {
      handleResubscribe(subscriptionId, unsubscriptionCode);
  } else {
      messageDiv.innerHTML = '<div class="alert alert-danger">Error: Missing required information to resubscribe. Please use the link provided in your email or text message.</div>';
      console.error("Missing subscriptionId or unsubscriptionCode in URL parameters.");
  }
}