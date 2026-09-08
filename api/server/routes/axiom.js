const express = require('express');
const { createAxiomService, getAxiomCookieOptions, CLAIM_COOKIE } = require('@librechat/api');
const middleware = require('~/server/middleware');
const db = require('~/models');

const router = express.Router();
const service = createAxiomService(db);

router.post('/issue', async (req, res) => {
  const result = await service.issue(
    req.get('X-Aeonthic-Keygen-Secret') ?? '',
    typeof req.body?.sourceHash === 'string' ? req.body.sourceHash : '',
  );
  return res.status(result.status).json(result.body);
});

router.post(
  '/redeem',
  middleware.axiomRedeemLimiter,
  middleware.axiomInvalidRedeemLimiter,
  middleware.checkBan,
  async (req, res) => {
    const result = await service.redeem(req.body?.key);
    if (result.claimToken) {
      res.cookie(CLAIM_COOKIE, result.claimToken, getAxiomCookieOptions());
    }
    return res.status(result.status).json(result.body);
  },
);

router.get('/session', async (req, res) => {
  const result = await service.session(req.cookies?.[CLAIM_COOKIE]);
  return res.status(result.status).json(result.body);
});

module.exports = { router, service };
