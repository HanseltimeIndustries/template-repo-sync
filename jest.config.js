module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '\\.tsx?$': 'ts-jest',
    '\\.jsx?$': 'babel-jest',
  },
  collectCoverage: true,
  collectCoverageFrom: ["./src/**"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      // Lines can get skewed by bucket files
      statements: 80,
    }
  }
}
