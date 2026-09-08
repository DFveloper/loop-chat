const rateLimit = require('express-rate-limit');
const { limiterCache, removePorts } = require('@librechat/api');

const message = { message: 'Too many AXIOM redemption attempts. Please try again later.' };

const common = {
  windowMs: 15 * 60 * 1000,
  keyGenerator: removePorts,
  handler: (_req, res) => res.status(429).json(message),
};

const axiomRedeemLimiter = rateLimit({
  ...common,
  max: 20,
  store: limiterCache('axiom_redeem_limiter'),
});

const axiomInvalidRedeemLimiter = rateLimit({
  ...common,
  max: 5,
  skipSuccessfulRequests: true,
  store: limiterCache('axiom_invalid_redeem_limiter'),
});

module.exports = { axiomRedeemLimiter, axiomInvalidRedeemLimiter };
