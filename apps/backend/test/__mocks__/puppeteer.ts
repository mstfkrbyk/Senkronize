export const launch = jest.fn().mockResolvedValue({
  newPage: jest.fn().mockResolvedValue({
    setContent: jest.fn().mockResolvedValue(undefined),
    pdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
    close: jest.fn().mockResolvedValue(undefined),
  }),
  close: jest.fn().mockResolvedValue(undefined),
});

export default { launch };
