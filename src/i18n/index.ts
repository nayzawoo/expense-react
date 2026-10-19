import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import my from './locales/my.json'

export const supportedLanguages = ['en', 'my'] as const
export type SupportedLanguage = (typeof supportedLanguages)[number]

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      my: { translation: my },
    },
    fallbackLng: 'en',
    supportedLngs: [...supportedLanguages],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'expense_lang',
    },
  })

export default i18n
