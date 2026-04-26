import { Request, Response, NextFunction } from 'express';
import { transferService } from '../services/transfer.service';
import { sendSuccess, sendError } from '../utils/response';
import { NotFoundError, ValidationError } from '../utils/errors';

export class TransferController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { sourceLocationId, destinationLocationId, items, notes } = req.body;
      const tenantId = req.tenantId!;
      const userId = req.user!.id;

      const transfer = await transferService.create(
        {
          sourceLocationId,
          destinationLocationId,
          items,
          notes,
        },
        userId,
        tenantId
      );

      return sendSuccess(res, transfer, 'Transfer created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { approved, reason } = req.body;
      const tenantId = req.tenantId!;
      const userId = req.user!.id;

      const transfer = await transferService.approve(id, approved, reason, userId, tenantId);

      return sendSuccess(
        res,
        transfer,
        approved ? 'Transfer approved' : 'Transfer rejected',
        200
      );
    } catch (error) {
      next(error);
    }
  }

  async ship(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { carrier, trackingNumber } = req.body;
      const tenantId = req.tenantId!;
      const userId = req.user!.id;

      if (!carrier || !trackingNumber) {
        throw new ValidationError('Carrier and tracking number required');
      }

      const transfer = await transferService.ship(id, carrier, trackingNumber, userId, tenantId);

      return sendSuccess(res, transfer, 'Transfer shipped', 200);
    } catch (error) {
      next(error);
    }
  }

  async receive(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { items } = req.body;
      const tenantId = req.tenantId!;
      const userId = req.user!.id;

      const transfer = await transferService.receive(id, items, userId, tenantId);

      return sendSuccess(res, transfer, 'Transfer items received', 200);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;

      const transfer = await transferService.getById(id, tenantId);

      if (!transfer) {
        throw new NotFoundError('Transfer not found');
      }

      return sendSuccess(res, transfer, 'Transfer retrieved', 200);
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { status, sourceLocationId, destinationLocationId, cursor, limit } = req.query;

      const { transfers, hasMore } = await transferService.list(tenantId, {
        status: status as any,
        sourceLocationId: sourceLocationId as string,
        destinationLocationId: destinationLocationId as string,
        cursor: cursor as string,
        limit: limit ? parseInt(limit as string) : 20,
      });

      return sendSuccess(
        res,
        {
          transfers,
          hasMore,
          nextCursor: hasMore ? transfers[transfers.length - 1].id : null,
        },
        'Transfers retrieved',
        200
      );
    } catch (error) {
      next(error);
    }
  }
}

export const transferController = new TransferController();
