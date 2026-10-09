#!/usr/bin/env bash
time curl -X POST ${1:-http://notify-bc-notifybc.192.168.99.100.nip.io/api}/notifications \
 -H 'Content-Type: application/json' \
 -d @- << EOF
{
   "serviceName": "${2:-load10}",
   "message": {
       "from": "${3:-no_reply@invlid.local}",
       "subject": "{title}",
       "htmlBody": "{description}<p><a href='{link}'>link</a><a href='{unsubscription_url}'>nsubscription</a></p>"
   },
   "channel": "email",
   "isBroadcast": true,
   "data": {
       "title": "Despite unpopularity, Victoria fadsasdfasd",
       "description": "Lorem ipsum dolor sit amet, facete debitis dolores nam eu, nemore voluptatum interesset at mel. Duo et legimus vituperata, mei adipisci prodesset conclusionemque an. Mnesarchum adversarium eam eu, ad postea labore vituperatoribus eam. Dicam convenire vis ei, id vis quod luptatum. Expetenda consequat at quo, mel inermis volumus intellegam ut, mei vocibus inciderint ea. At error viris has.",
       "pubDate": "2017-07-20T16:18:04.000Z",
       "link": "http://foo.com",
       "guid": "12356"
   }
}
EOF