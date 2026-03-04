module.exports = {
  merge: () => {
    return JSON.stringify(
      {
        downstream: true,
      },
      null,
      4,
    );
  },
  validate: () => {
    return ["oh no!", "not this one too!"];
  },
};
