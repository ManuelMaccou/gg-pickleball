import Cookies from 'js-cookie';

export const getCookie = (name: string): string | null => {
  const cookie = Cookies.get(name);
  return cookie || null;
};

export const setCookie = (name: string, value: string, days: number = 7): void => {
  Cookies.set(name, value, { expires: days, sameSite: 'strict' });
};
