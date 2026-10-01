let axios = require('axios');
const net = require('net');
const util = require('util');
const dns = require('dns');

module.exports = function (Model, options) {
  var ipRangeCheck = require('ip-range-check');
  var _ = require('lodash');
  var toSentence = require('underscore.string/toSentence');
  var pluralize = require('pluralize');
  Model.createOptionsFromRemotingContext = function (ctx) {
    var base = this.base.createOptionsFromRemotingContext(ctx);
    base.httpContext = ctx;
    return base;
  };

  Model.isAdminReq = function (httpCtx, ignoreAccessToken, ignoreSurrogate) {
    // internal requests
    if (!httpCtx || !httpCtx.req) {
      return true;
    }
    if (!ignoreSurrogate) {
      if (
        httpCtx.req.get('SM_UNIVERSALID') ||
        httpCtx.req.get('sm_user') ||
        httpCtx.req.get('smgov_userdisplayname') ||
        httpCtx.req.get('is_anonymous')
      ) {
        return false;
      }
    }
    if (!ignoreAccessToken) {
      try {
        let token = httpCtx.args.options && httpCtx.args.options.accessToken;
        if (token && token.userId) {
          return true;
        }
      } catch (ex) { }
    }

    var adminIps =
      Model.app.get('adminIps') || Model.app.get('defaultAdminIps');
    if (adminIps) {
      return adminIps.some(function (e, i) {
        return ipRangeCheck(httpCtx.req.ip, e);
      });
    }
    return false;
  };

  Model.getCurrentUser = function (httpCtx) {
    // internal requests
    if (!httpCtx) return null;

    var currUser =
      httpCtx.req.get('SM_UNIVERSALID') ||
      httpCtx.req.get('sm_user') ||
      httpCtx.req.get('smgov_userdisplayname');
    if (!currUser) {
      return null;
    }
    if (Model.isAdminReq(httpCtx, undefined, true)) {
      return currUser;
    }
    var siteMinderReverseProxyIps =
      Model.app.get('siteMinderReverseProxyIps') ||
      Model.app.get('defaultSiteMinderReverseProxyIps');
    if (!siteMinderReverseProxyIps || siteMinderReverseProxyIps.length <= 0) {
      return null;
    }
    // rely on express 'trust proxy' settings to obtain real ip
    var realIp = httpCtx.req.ip;
    var isFromSM = siteMinderReverseProxyIps.some(function (e) {
      return ipRangeCheck(realIp, e);
    });
    return isFromSM ? currUser : null;
  };

  let smsClient;
  const Twillio = require('twilio');
  Model.sendSMS = async function (to, textBody, data, cb) {
    let smsServiceProvider = Model.app.get('smsServiceProvider');
    let smsConfig = Model.app.get('sms')[smsServiceProvider];
    switch (smsServiceProvider) {
      case 'gcnotify':
        try {
          let url = smsConfig['baseUrl'];
          url = url.concat(smsConfig['api']);
          let body = {
            'phone_number': to,
            'template_id': '059b4d59-1d9e-4218-92f6-e77be7df2809',
            'personalisation': {
              'body_text': textBody
            }
          };
          await axios.post(url, body, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': smsConfig['accountKey']
            }
          });
        } catch (ex) {
          return cb && cb(ex);
        }
        cb && cb();
        break;
      default:
        // Twilio Credentials
        var accountSid = smsConfig.accountSid;
        var authToken = smsConfig.authToken;

        //require the Twilio module and create a REST client
        smsClient = smsClient || new Twillio(accountSid, authToken);

        smsClient.messages.create(
          {
            to: to,
            from: smsConfig.fromNumber,
            body: textBody,
          },
          function (err, message) {
            cb && cb(err, message);
          }
        );
    }
    await delay(1000);
  };

  let nodemailer = require('nodemailer');
  const directTransport = require('nodemailer-direct-transport');
  let transporter;
  Model.sendEmail = async function (mailOptions, cb) {
    const smtpCfg = Model.app.get('smtp') || Model.app.get('defaultSmtp');
    if (!transporter) {
      if (smtpCfg.direct) {
        transporter = nodemailer.createTransport(directTransport(smtpCfg));
      } else {
        transporter = nodemailer.createTransport(smtpCfg);
      }
    }
    let info;
    try {
      info = await transporter.sendMail(mailOptions);
      if (info && info.accepted && info.accepted.length < 1) {
        throw new Error('delivery failed');
      }
    } catch (ex) {
      if (
        smtpCfg.direct ||
        net.isIP(smtpCfg.host) ||
        ex.command !== 'CONN' ||
        ['ECONNECTION', 'ETIMEDOUT'].indexOf(ex.code) === -1
      ) {
        if (cb) {
          return cb(ex, info);
        }
        throw ex;
      }
      const dnsLookupAsync = util.promisify(dns.lookup);
      const addresses = await dnsLookupAsync(smtpCfg.host, { all: true });
      if (!(addresses instanceof Array)) {
        if (cb) {
          return cb(ex, info);
        }
        throw ex;
      }
      // do client retry if there are multiple addresses
      for (const [index, address] of addresses.entries()) {
        const newSmtpCfg = Object.assign({}, smtpCfg, {
          host: address.address,
        });
        const newTransporter = nodemailer.createTransport(newSmtpCfg);
        try {
          info = await newTransporter.sendMail(mailOptions);
          if (info && info.accepted && info.accepted.length < 1) {
            throw new Error('delivery failed');
          }
        } catch (newEx) {
          if (
            index < addresses.length - 1 &&
            newEx.command === 'CONN' &&
            ['ECONNECTION', 'ETIMEDOUT'].indexOf(newEx.code) >= 0
          ) {
            continue;
          }
          if (cb) {
            return cb(newEx, info);
          }
          throw newEx;
        }
        break;
      }
    }
    cb && cb(null, info);
    return info;
  };

  Model.mailMerge = function (srcTxt, data, httpCtx) {
    let output = srcTxt;
    try {
      output = output.replace(
        /\{subscription_confirmation_code\}/gi,
        data.confirmationRequest.confirmationCode
      );
    } catch (ex) { }
    try {
      output = output.replace(/\{service_name\}/gi, data.serviceName);
    } catch (ex) { }
    try {
      if (output.match(/\{unsubscription_service_names\}/i)) {
        let serviceNames = _.union(
          [data.serviceName],
          data.unsubscribedAdditionalServices
            ? data.unsubscribedAdditionalServices.names
            : []
        );
        output = output.replace(
          /\{unsubscription_service_names\}/gi,
          pluralize('service', serviceNames.length) +
          ' ' +
          toSentence(serviceNames)
        );
      }
    } catch (ex) { }
    let httpHost;
    try {
      if (httpCtx.req) {
        httpHost = httpCtx.req.protocol + '://' + httpCtx.req.get('host');
      }
      if (Model.app.get('httpHost')) {
        httpHost = Model.app.get('httpHost');
      }
      if (httpCtx.args && httpCtx.args.data && httpCtx.args.data.httpHost) {
        httpHost = httpCtx.args.data.httpHost;
      } else if (httpCtx.instance && httpCtx.instance.httpHost) {
        httpHost = httpCtx.instance.httpHost;
      }
      output = output.replace(/\{http_host\}/gi, httpHost);
    } catch (ex) { }
    try {
      output = output.replace(
        /\{rest_api_root\}/gi,
        Model.app.get('restApiRoot')
      );
    } catch (ex) { }
    try {
      output = output.replace(/\{subscription_id\}/gi, data.id);
    } catch (ex) { }
    try {
      output = output.replace(
        /\{unsubscription_code\}/gi,
        data.unsubscriptionCode
      );
    } catch (ex) { }
    try {
      output = output.replace(
        /\{unsubscription_url\}/gi,
        httpHost +
        '/unsubscribe.html?subscriptionId=' +
        data.id +
        '&unsubscriptionCode=' +
        data.unsubscriptionCode
      );
    } catch (ex) { }
    try {
      output = output.replace(
        /\{unsubscription_all_url\}/gi,
        httpHost +
        '/unsubscribe.html?subscriptionId=' +
        data.id +
        '&unsubscriptionCode=' +
        data.unsubscriptionCode +
        '&additionalServices=_all'
      );
    } catch (ex) { }
    try {
      output = output.replace(
        /\{subscription_confirmation_url\}/gi,
        httpHost +
        Model.app.get('restApiRoot') +
        '/subscriptions/' +
        data.id +
        '/verify?confirmationCode=' +
        data.confirmationRequest.confirmationCode
      );
    } catch (ex) { }
    try {
      output = output.replace(
        /\{unsubscription_reversion_url\}/gi,
        httpHost +
        '/resubscribe.html?subscriptionId=' +
        data.id +
        '&unsubscriptionCode=' +
        data.unsubscriptionCode
      );
    } catch (ex) { }

    // for backward compatibilities
    try {
      output = output.replace(
        /\{confirmation_code\}/gi,
        data.confirmationRequest.confirmationCode
      );
    } catch (ex) { }
    try {
      output = output.replace(/\{serviceName\}/gi, data.serviceName);
    } catch (ex) { }
    try {
      output = output.replace(
        /\{restApiRoot\}/gi,
        Model.app.get('restApiRoot')
      );
    } catch (ex) { }
    try {
      output = output.replace(/\{subscriptionId\}/gi, data.id);
    } catch (ex) { }
    try {
      output = output.replace(
        /\{unsubscriptionCode\}/gi,
        data.unsubscriptionCode
      );
    } catch (ex) { }
    try {
      if (data.data) {
        // substitute all other tokens with matching data.data properties
        let matches = output.match(/{.+?}/g);
        if (matches) {
          matches.forEach(function (e) {
            try {
              let token = e.match(/{(.+)}/)[1];
              let val = _.get(data.data, token);
              if (val) {
                output = output.replace(e, val);
              }
            } catch (ex) { }
          });
        }
      }
    } catch (ex) { }
    return output;
  };

  Model.updateTimestamp = function (ctx, next) {
    let token;
    try {
      token =
        ctx.options.httpContext.args.options &&
        ctx.options.httpContext.args.options.accessToken;
    } catch (ex) { }
    try {
      if (ctx.instance) {
        ctx.instance.updated = new Date();
        ctx.instance.updatedBy = {
          ip: ctx.options.httpContext && ctx.options.httpContext.req.ip,
          eventSrc: ctx.options.eventSrc,
        };
        if (token && token.userId) {
          ctx.instance.updatedBy.adminUser = token.userId;
        }
        if (ctx.isNewInstance) {
          ctx.instance.createdBy = {
            ip: ctx.options.httpContext.req.ip,
          };
          if (token && token.userId) {
            ctx.instance.createdBy.adminUser = token.userId;
          }
        }
      } else if (ctx.data) {
        ctx.data.updated = new Date();
        ctx.data.updatedBy = {
          ip: ctx.options.httpContext && ctx.options.httpContext.req.ip,
          eventSrc: ctx.options.eventSrc,
        };
        if (token && token.userId) {
          ctx.data.updatedBy.adminUser = token.userId;
        }
        if (ctx.isNewInstance) {
          ctx.data.createdBy = {
            ip: ctx.options.httpContext.req.ip,
          };
          if (token && token.userId) {
            ctx.data.createdBy.adminUser = token.userId;
          }
        }
      }
    } catch (ex) { }
    next();
  };

  Model.observe('before save', (ctx, next) => {
    Model.updateTimestamp(ctx, next);
  });

  Model.getMergedConfig = async function (configName, serviceName, next) {
    let data;
    try {
      data = await Model.app.models.Configuration.findOne({
        where: {
          name: configName,
          serviceName: serviceName,
        },
      });
    } catch (ex) {
      if (next) {
        return next(ex, null);
      } else {
        throw ex;
      }
    }
    let res;
    try {
      res = _.merge({}, Model.app.get(configName));
    } catch (ex) { }
    try {
      res = _.merge({}, res, data.value);
    } catch (ex) { }
    next && next(null, res);
    return res;
  };
};

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}
module.exports.axios = axios;
