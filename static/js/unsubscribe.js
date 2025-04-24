async function handleUnsubscribe(subscriptionId, unsubscriptionCode) {
  const messageDiv = document.getElementById('message');
  try {
    const response = await fetch(`/api/unsubscribe/${subscriptionId}/${unsubscriptionCode}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      window.location.href = `/unsubscription_acknowledged.html?channel=email`;
    } else {
      const errorData = await response.json();
      console.error("Backend unsubscription failed:", errorData);
      messageDiv.innerHTML = `<div class="alert alert-danger">Error: Could not unsubscribe. 'Please try again later.'}</div>`;
    }
  } catch (error) {
    console.error("Error calling backend for unsubscription:", error);
    messageDiv.innerHTML = '<div class="alert alert-danger">Error: Could not reach the server to unsubscribe.</div>';
  }
}

function initiateUnsubscribe() {
  const urlParams = new URLSearchParams(window.location.search);
  const subscriptionId = urlParams.get('subscriptionId');
  const unsubscriptionCode = urlParams.get('unsubscriptionCode');
  const messageDiv = document.getElementById('message');

  if (subscriptionId && unsubscriptionCode) {
      handleUnsubscribe(subscriptionId, unsubscriptionCode);
  } else {
      messageDiv.innerHTML = '<div class="alert alert-danger">Error: Missing required information to unsubscribe. Please use the link provided in your email or text message.</div>';
      console.error("Missing subscriptionId or unsubscriptionCode in URL parameters.");
  }
}