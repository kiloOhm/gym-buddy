// Extends app.json. Only adds `experiments.baseUrl` when WEB_BASE_URL is set (e.g. `/gym-buddy` for
// the GitHub Pages project URL); the dev server reads this file too, so it must stay unset locally.
module.exports = ({ config }) => {
  const baseUrl = process.env.WEB_BASE_URL;
  if (!baseUrl) return config;
  return {
    ...config,
    experiments: { ...config.experiments, baseUrl },
  };
};
