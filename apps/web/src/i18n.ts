import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ar from './locales/ar.json';
import en from './locales/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en }
    },
    fallbackLng: 'ar',
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    }
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  document.documentElement.dir = lng.startsWith('ar') ? 'rtl' : 'ltr';
});

// Set initial direction
document.documentElement.lang = i18n.language || 'ar';
document.documentElement.dir = (i18n.language || 'ar').startsWith('ar') ? 'rtl' : 'ltr';

export default i18n;
