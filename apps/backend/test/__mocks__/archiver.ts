function archiverMock(): {
  pipe: jest.Mock;
  append: jest.Mock;
  finalize: jest.Mock;
  on: jest.Mock;
} {
  const instance = {
    pipe: jest.fn().mockReturnThis(),
    append: jest.fn().mockReturnThis(),
    finalize: jest.fn().mockResolvedValue(undefined),
    on: jest.fn().mockReturnThis(),
  };
  return instance;
}

const archiver = jest.fn(() => archiverMock());

export default archiver;
