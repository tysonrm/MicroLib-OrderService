import { hash, encrypt } from './utils';

/**
 * @callback mixinFunction
 * @param {Object} o Object to compose
 * @returns {Object} Composed object
 */

/**
 * @callback functionalMixinFactory
 * @param {*} mixinFunctionParams params for mixin function 
 * @returns {mixinFunction}
 */

/**
 * use to acccess previous version of the model
 */
export const PREVMODEL = Symbol('prevModel');

/**
 *
 */
export const mixinType = {
  pre: Symbol('pre'),
  post: Symbol('post')
}

/**
 * 
 */
export const mixinSets = {
  [mixinType.pre]: Symbol('preUpdateMixins'),
  [mixinType.post]: Symbol('postUpdateMixins')
}

/**
 * Store mixins for execution on update
 * @param {mixinType} type 
 * run before changes or after
 * @param {*} o  Object containing changes to apply (pre) 
 * or new object after changes have been applied (post)
 * @param {string} name `Function.name` 
 * @param {mixinFunction} cb mixin function
 */
function updateMixins(type, o, name, cb) {
  if (!mixinSets[type]) {
    throw new Error('invalid mixin set');
  }

  const mixinSet = o[mixinSets[type]] || new Map();
  // mixinSet.toJSON = () => void 0; // don't show this

  if (!mixinSet.has(name)) {
    mixinSet.set(name, cb());

    return {
      ...o,
      [mixinSets[type]]: mixinSet
    }
  }
  return o;
}

/**
 * Functional mixin that encrypts the properties specified in `propNames`  
 * @param  {...string} propNames - The properties to encrypt
 */
const encryptProperties = (...propNames) => (o) => {
  const encryptProps = () => {
    return propNames.map(p => o[p]
      ? { [p]: encrypt(o[p]) }
      : {})
      .reduce((p, c) => ({ ...c, ...p }));
  }

  const mixins = updateMixins(
    mixinType.pre, o, encryptProperties.name,
    () => encryptProperties(...propNames)
  );

  return {
    ...mixins,
    ...encryptProps()
  }
}

/**
 * Functional mixin that prevents properties from being updated.
 * Accepts a property name or a function that returns a property name.
 * @param {boolean} isUpdate - set to true on update
 * @param  {...string} propNames - names of properties to freeze
 */
const freezeProperties = (isUpdate, ...propNames) => (o) => {
  const preventUpdates = () => {
    const conditionalp = propNames.map(p => {
      return typeof p === 'function' ? p(o) : p;
    });
    const intersection = Object.keys(o)
      .filter(key => conditionalp.includes(key));

    if (intersection?.length > 0) {
      throw new Error(`cannot update readonly properties: ${intersection}`);
    }
  }

  if (isUpdate) {
    preventUpdates();
  }

  return updateMixins(
    mixinType.pre, o, freezeProperties.name,
    () => freezeProperties(true, ...propNames)
  );
}

/** 
 * Functional mixin that enforces required fields 
 * @param  {...string} propNames - required property names
 */
const requireProperties = (...propNames) => (o) => {
  const missing = propNames.filter(key => !o[key]);
  if (missing?.length > 0) {
    throw new Error(`missing required properties: ${missing}`);
  }
  return o;
}

/**
 * Functional mixin that hashes passwords
 * @param {*} hash hash algorithm
 * @param  {...any} propNames name of password props
 */
const hashPasswords = (hash, ...propNames) => (o) => {
  function hashPwds() {
    return propNames.map(p => o[p]
      ? { [p]: hash(o[p]) }
      : {})
      .reduce((p, c) => ({ ...c, ...p }));
  }

  const mixins = updateMixins(
    mixinType.pre, o, hashPasswords.name,
    () => hashPasswords(hash, ...propNames)
  );

  return {
    ...mixins,
    ...hashPwds()
  }
}

const internalPropList = [];

const allowProperties = (isUpdate, ...propNames) => (o) => {
  function rejectUnknownProps() {
    const allowList = propNames.concat(internalPropList);
    const unknownProps = Object.keys(o).filter(k => !allowList.includes(k))

    if (unknownProps?.length > 0) {
      throw new Error(`invalid properties: ${unknownProps}`);
    }
  }

  if (isUpdate) {
    rejectUnknownProps();
  }

  return updateMixins(
    mixinType.pre, o, allowProperties.name,
    () => allowProperties(true, ...propNames)
  );
}

/**
 * @callback isValid
 * @param {Object} o - the property owner
 * @param {*} propVal - the property value
 * @returns {boolean} - true if valid
 */

/**
 * @typedef {{
 *  propName:string,
 *  isValid?:isValid,
 *  values?:any[],
 *  regex?:string,
 *  typeof?:string,
 *  length?:number
 * }[]} validations 
 */

/**
 * 
 * @param {validations} validations
 */
const validatePropertyValues = (validations) => (o) => {
  const invalid = validations.filter(v => {
    const propVal = o[v.propName];
    if (!propVal) {
      return false;
    }
    if (v.isValid) {
      if (!v.isValid(o, propVal)) {
        return true;
      }
    }
    if (v.values?.length > 0) {
      if (!v.values.includes(propVal)) {
        return true;
      }
    }
    if (v.typeof) {
      if (typeof propVal !== v.typeof) {
        return true;
      }
    }
    if (v.length) {
      if (propVal.length > v.length) {
        return true;
      }
    }
    if (v.regex) {
      if (!new RegExp(v.regex).test(propVal)) {
        return true;
      }
    }
    return false;
  });

  if (invalid?.length > 0) {
    throw new Error(
      `invalid value for ${[...invalid.map(v => v.propName)]}`
    );
  }

  return updateMixins(
    mixinType.post, o, validatePropertyValues.name,
    () => validatePropertyValues(validations)
  );
}

/**
 * require properties listed in `propNames`
 * @param  {...any} propNames 
 */
export function requirePropertiesMixin(...propNames) {
  return requireProperties(...propNames);
}

/**
 * disallow updates to properties listed in `propNames`
 * @param  {...any} propNames 
 */
export function freezePropertiesMixin(...propNames) {
  return freezeProperties(false, ...propNames);
}

/**
 * encyrpt properties listed in `propNames`
 * @param  {...any} propNames 
 */
export function encryptPropertiesMixin(...propNames) {
  return encryptProperties(...propNames);
}

/**
 * hash passwords listed in `propNames`
 * @param  {...any} propNames 
 */
export function hashPasswordsMixin(...propNames) {
  return hashPasswords(hash, ...propNames);
}

/**
 * only allow properties listed in `propNames`
 * @param  {...any} propNames 
 */
export function allowPropertiesMixin(...propNames) {
  return allowProperties(false, ...propNames);
}

/**
 * Validate property values are members of a list, 
 * match a regular expression, are of a certain length, or type,
 * or satisfy a custom validation function.
 * @param {validations} validations 
 */
export function validatePropertyValuesMixin(validations) {
  return validatePropertyValues(validations);
}

// Implement GDPR across models
const encryptPersonalInfo = encryptProperties(
  'lastName',
  'address',
  'email',
  'phone',
  'mobile',
  'creditCard',
  'ccv',
  'ssn'
);

/**
 * Global mixins
 */
const GlobalMixins = [
  encryptPersonalInfo
];

export default GlobalMixins;

