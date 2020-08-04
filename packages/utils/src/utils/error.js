// Reasons
const INVALID_ADDRESS = "Ethereum address is invalid";
// const USER_NOT_FOUND = "User not found";
// const INTERNAL_ERROR = "Something went wrong";

// Categories
const INPUT = "input";
// Types
const ADDRESS = "address";

// ###### USER INPUT VALIDATION #####

const inputErrorMessage = (type) => {
  const validationErrors = {};
  if (type === ADDRESS) return INVALID_ADDRESS;
};

const throwError = (category, type) => {
  if (category === INPUT) throw inputErrorMessage(type);
};

export const getErrorResponse = (error, className, functionName) => {
  const errorText = typeof error === "string" ? error : error.message;
  return `Error @rtoken/utils ${className}.${functionName}(): ${errorText}`;
};

module.exports = { getErrorResponse, throwError };
