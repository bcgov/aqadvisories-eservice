import { check } from "k6";
import http from "k6/http";
import { Rate } from "k6/metrics";


export let errorRate = new Rate("errors");


function checkStatus(response, checkName, statusCode = 200) {
  let success = check(response, {
    [checkName]: (r) => {
      if (r.status === statusCode) {
        return true;
      } else {
        console.error(checkName + " failed. Incorrect response code." + r.status);
        return false;
      }
    }
  });
  errorRate.add(!success, { tag1: checkName });
}


// The backend (NotifyBC) has no public route, so load it through the frontend:
// resubscribing an unknown subscription makes the frontend call NotifyBC, which looks
// it up in MongoDB and answers 404 (500 means the backend is unreachable). Read-only.
// 404 is the expected answer, so don't count it in http_req_failed.
http.setResponseCallback(http.expectedStatuses(404));

export default function() {
  let url = `${__ENV.BACKEND_URL}/resubscribe/000000000000000000000000/123`;
  let res = http.get(url);
  checkStatus(res, "resubscribe-unknown-subscription", 404);

}
