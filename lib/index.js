const Client = require('rooftop-client')
const Joi = require('joi')
const W = require('when')

module.exports = class Rooftop {
  constructor (opts) {
    const validatedOptions = this._validate(opts)
    Object.assign(this, validatedOptions)
    this.client = Client.new({ name: this.name, apiToken: this.apiToken })
  }

  apply (compiler) {
    compiler.plugin('run', this.run.bind(this, compiler))
    compiler.plugin('watch-run', this.run.bind(this, compiler))
  }

  run (compiler, compilation, done) {
    return W.reduce(this.contentTypes, (m, ct) => {
      let name
      let options
      let transform

      if (typeof ct === 'string') {
        name = ct
        options = {}
        transform = true
      } else {
        name = ct.name
        options = ct
        transform = ct.transform
        delete options.name
        delete options.transform
      }

      if (transform === true) {
        transform = (x) => x // TODO: replace with standard transform fn
      }

      if (transform === false) {
        transform = (x) => x // identity, pass through
      }

      return this.client[name].get(options)
        .then(transform)
        .tap((res) => { m[name] = res })
        .yield(m)
    }, {}).tap((res) => {
      // now we put the results on the locals
      compiler.options.locals.rooftop = res
      done()
    })
  }

  _validate (opts = {}) {
    const schema = Joi.object().keys({
      name: Joi.string().required(),
      apiToken: Joi.string().required(),
      contentTypes: Joi.array().items(
        Joi.string(), Joi.object().keys({
          name: Joi.string(),
          transform: Joi.boolean().default(true)
        })
      ).default(['posts'])
    })

    const res = Joi.validate(opts, schema, {
      allowUnknown: true,
      language: {
        messages: { wrapArrays: false },
        object: { child: '!![roots-mini-rooftop constructor] option {{reason}}' }
      }
    })
    if (res.error) { throw new Error(res.error) }
    return res.value
  }
}