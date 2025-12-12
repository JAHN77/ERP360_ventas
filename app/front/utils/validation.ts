
export const isEmail = (email: string): boolean => {
  if (!email) return false;
  // Regex más robusto para emails
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(String(email).trim().toLowerCase());
};

export const isNotEmpty = (value: string | null | undefined): boolean => {
  return value !== null && value !== undefined && String(value).trim().length > 0;
};

export const isNumber = (value: any): boolean => {
  return !isNaN(parseFloat(value)) && isFinite(value);
};

export const isPositiveNumber = (value: any): boolean => {
  return isNumber(value) && parseFloat(value) > 0;
};

export const isNonNegativeNumber = (value: any): boolean => {
  return isNumber(value) && parseFloat(value) >= 0;
};

export const isInteger = (value: any): boolean => {
  // Check if it's a number and has no decimal part
  return isNumber(value) && Number(value) % 1 === 0;
};

export const isPositiveInteger = (value: any): boolean => {
  return isInteger(value) && Number(value) > 0;
}

export const isNonNegativeInteger = (value: any): boolean => {
  return isInteger(value) && Number(value) >= 0;
};

export const hasMinLength = (value: string, min: number): boolean => {
  return String(value).length >= min;
}

export const isWithinRange = (value: number, min: number, max: number): boolean => {
  return isNumber(value) && value >= min && value <= max;
}
