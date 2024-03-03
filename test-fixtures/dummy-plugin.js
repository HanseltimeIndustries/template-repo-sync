module.exports = {
  merge: () => {
    return JSON.stringify({ tested: true }, null, 4);
  },
  validate: () => {
    return [];
  },
};
