'use strict'

const uuid = require('../lib/utils').uuid;
const SmartyStreetsSDK = require("smartystreets-javascript-sdk");

const SmartyStreetsCore = SmartyStreetsSDK.core;
const Lookup = SmartyStreetsSDK.usStreet.Lookup;

// for Server-to-server requests, use this code:
let enabled = false;
//let enabled = process.env.SMARTY_ENABLED || false;
let authId = process.env.SMARTY_AUTH_ID;
let authToken = process.env.SMARTY_AUTH_TOKEN;
const credentials = new SmartyStreetsCore.StaticCredentials(authId, authToken);

let client = SmartyStreetsCore.buildClient.usStreet(credentials);

// Documentation for input fields can be found at:
// https://smartystreets.com/docs/us-street-api#input-fields

export async function validateAddress(address) {
  console.log('validating address...');

  if (!address) {
    return;
  }

  if (!enabled) {
    return address;
  }

  let lookup = new Lookup();
  lookup.inputId = uuid();
  lookup.street = address;
  lookup.maxCandidates = 1;

  try {
    await client.send(lookup);
  } catch (error) {
    throw new Error(error);
  }
}