/**
 * Trace — Login & weekly questionnaire
 * Uses localStorage. Questionnaire is optional at start; notifications show questions that will come up.
 */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'trace_user';
  const QUESTIONNAIRE_KEY = 'trace_questionnaire';
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  const QUESTIONNAIRE_FIELDS = [
    { id: 'school_name', label: 'What is your school name?', type: 'text', required: true },
    { id: 'childhood_best_friend', label: "What is your childhood best friend's name?", type: 'text', required: true },
    { id: 'mother_maiden_name', label: "What is your mother's maiden name?", type: 'text', required: true },
    { id: 'favourite_movie', label: "What is your favourite movie?", type: 'text', required: true },
    { id: 'nickname', label: "What is your nickname?", type: 'text', required: true }
  ];

  function getStored(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setStored(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  function getUser() {
    return getStored(STORAGE_KEY);
  }

  function setUser(data) {
    setStored(STORAGE_KEY, data);
  }

  function getQuestionnaireData() {
    return getStored(QUESTIONNAIRE_KEY) || {};
  }

  function setQuestionnaireDone(answers) {
    const data = getQuestionnaireData();
    data.lastCompleted = Date.now();
    data.answers = data.answers || [];
    data.answers.push({ at: Date.now(), ...answers });
    setStored(QUESTIONNAIRE_KEY, data);
  }

  function needsQuestionnaire() {
    const user = getUser();
    if (!user || !user.id) return false;
    const q = getQuestionnaireData();
    const last = q.lastCompleted;
    if (!last) return true;
    return (Date.now() - last) >= WEEK_MS;
  }

  function isLoggedIn() {
    const u = getUser();
    return !!(u && u.id);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
  }

  global.TraceAuth = {
    getUser,
    setUser,
    getQuestionnaireData,
    setQuestionnaireDone,
    needsQuestionnaire,
    isLoggedIn,
    logout,
    QUESTIONNAIRE_FIELDS,
    WEEK_MS
  };
})(typeof window !== 'undefined' ? window : this);
