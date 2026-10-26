import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  DB_SYNCHRONIZE: Joi.boolean(),
  PROVIDER_BASE_URL: Joi.string().uri().required(),
  PROVIDER_TIMEOUT_MS: Joi.number().integer().positive().default(3000),
});
