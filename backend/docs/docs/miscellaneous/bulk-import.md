---
permalink: /docs/bulk-import/
---

# Bulk Import

To facilitate migrating subscriptions from other notification systems, _NotifyBC_ provides a utility script to bulk import subscription data from a .csv file. To use the utility, you need

- Software installed
  - NodeJS@>=6.9.1
  - Git
- Admin Access to a _NotifyBC_ instance by adding your client ip to the [Admin IP List](../config-adminIpList/)
- a csv file with header row matching [subscription model schema](../api-subscription/#model-schema). A sample csv file is [provided](https://github.com/bcgov/NotifyBC/tree/main/utils/bulk-import/sample-subscription.csv). Compound fields (of object type) should be dot-flattened as shown in the sample for field _confirmationRequest.sendRequest_

To run the utility

```bash
~ $ git clone \
https://github.com/bcgov/NotifyBC.git \
notifyBC
~ $ cd notifyBC
~/notifyBC $ npm i -g yarn && yarn install
~/notifyBC $ node utils/bulk-import/subscription.js \
-a <api-url-prefix> -c <concurrency> <csv-file-path>
```

Here \<csv-file-path\> is the path to csv file and \<api-url-prefix\> is the _NotifyBC_ api url prefix , default to _http://localhost:3000/api_.

The script parses the csv file and generates a HTTP post request for each row. The concurrency of HTTP request is controlled by option _-c_ which is default to 10 if omitted. A successful run should output the number of rows imported without any error message

```
success row count = ***
```

### Field Parsers

The utility script takes care of type conversion for built-in fields. If you need to import proprietary fields, by default the fields are imported as strings. To import non-string fields or manipulating json output, you need to define [custom parsers](https://github.com/Keyang/node-csvtojson#custom-parsers) in file [_utils/bulk-import/subscription.js_](https://github.com/bcgov/NotifyBC/blob/main/utils/bulk-import/subscription.js). For example, to parse _myCustomIntegerField_ to integer, add in the _colParser_ object

```js
  colParser: {
    ...
    , myCustomIntegerField: (item, head, resultRow, row, colIdx) => {
      return parseInt(item)
    }
  }
```
