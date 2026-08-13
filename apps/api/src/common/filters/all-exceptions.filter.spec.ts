import type { ArgumentsHost } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  function buildHost(reply: {
    status: jest.Mock;
    send: jest.Mock;
  }): ArgumentsHost {
    return {
      switchToHttp: () => ({
        getResponse: () => reply,
      }),
    } as unknown as ArgumentsHost;
  }

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it('should return 409 Conflict for Postgres FK violation (23503)', () => {
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });
    const error = Object.assign(new Error('violates foreign key'), {
      code: '23503',
    });

    filter.catch(error, buildHost({ status, send }));

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: 'Registro possui dependências vinculadas',
      }),
    );
  });

  it('should pass through HttpException responses', () => {
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

    filter.catch(exception, buildHost({ status, send }));

    expect(status).toHaveBeenCalledWith(404);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Not found' }),
    );
  });

  it('should return 500 for unknown exceptions', () => {
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });

    filter.catch(new Error('boom'), buildHost({ status, send }));

    expect(status).toHaveBeenCalledWith(500);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' }),
    );
  });
});
