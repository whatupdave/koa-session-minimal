'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const uid = require('uid-safe');
const deepEqual = require('deep-equal');
const Store = require('./store');
const MemoryStore = require('./memory_store');

const ONE_DAY = 24 * 3600 * 1000;

const cookieOpt = (cookie, ctx) => {
  const obj = cookie instanceof Function ? cookie(ctx) : cookie;
  const options = Object.assign({
    maxAge: 0,
    path: '/',
    httpOnly: true
  }, obj || {}, {
    overwrite: true,
    signed: false });
  if (!(options.maxAge >= 0)) options.maxAge = 0;
  return options;
};

const deleteSession = (ctx, key, cookie, store, sid) => {
  const tmpCookie = Object.assign({}, cookie);
  delete tmpCookie.maxAge;
  ctx.cookies.set(key, null, tmpCookie);
  store.destroy(`${key}:${sid}`);
};

const saveSession = (ctx, key, cookie, store, sid) => {
  const ttl = cookie.maxAge > 0 ? cookie.maxAge : ONE_DAY;
  ctx.cookies.set(key, sid, cookie);
  store.set(`${key}:${sid}`, ctx.session, ttl);
};

const cleanSession = ctx => {
  if (!ctx.session || typeof ctx.session !== 'object') ctx.session = {};
};

module.exports = options => {
  const opt = options || {};
  const key = opt.key || 'koa:sess';
  const store = new Store(opt.store || new MemoryStore());
  const getCookie = ctx => cookieOpt(opt.cookie, ctx);

  return (() => {
    var _ref = _asyncToGenerator(function* (ctx, next) {
      const oldSid = ctx.cookies.get(key);

      let sid = oldSid;

      const regenerateId = function () {
        sid = opt.genid && opt.genid(ctx) || uid.sync(24);
      };

      if (!sid) {
        regenerateId();
        ctx.session = {};
      } else {
        ctx.session = yield store.get(`${key}:${sid}`);
        cleanSession(ctx);
      }

      const oldData = JSON.parse(JSON.stringify(ctx.session));

      ctx.sessionHandler = {
        regenerateId
      };

      yield next();

      cleanSession(ctx);
      const hasData = Object.keys(ctx.session).length > 0;

      if (sid === oldSid) {
        if (deepEqual(ctx.session, oldData)) return;

        const cookie = getCookie(ctx);
        const action = hasData ? saveSession : deleteSession;
        action(ctx, key, cookie, store, sid);
      } else {
        const cookie = getCookie(ctx);
        if (oldSid) deleteSession(ctx, key, cookie, store, oldSid);
        if (hasData) saveSession(ctx, key, cookie, store, sid);
      }
    });

    return function (_x, _x2) {
      return _ref.apply(this, arguments);
    };
  })();
};