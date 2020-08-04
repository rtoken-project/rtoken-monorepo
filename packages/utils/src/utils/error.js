// General messages
const USER_INPUT_ERROR = "Input is invalid";

// Reasons
const INVALID_ADDRESS = "Wallet address is invalid";
// const USER_NOT_FOUND = "User not found";
// const INTERNAL_ERROR = "Something went wrong";

// Categories
INPUT = "input";
// Types
ADDRESS = "address";

// ###### USER INPUT VALIDATION #####

const getInputError = (type) => {
  const validationErrors = {};
  if (type === ADDRESS) return INVALID_ADDRESS;
};

const throwError = (category, type) => {
  if (type === INPUT) throw getInputError(error);
};

export const getErrorResponse = (error, functionName) => {
  const errorText = typeof error === "string" ? error : error.message;
  return {
    error: {
      message: `Error @rtoken/utils.${functionName}(): ${errorText}`,
    },
  };
};

module.exports = { getErrorResponse, throwError };
