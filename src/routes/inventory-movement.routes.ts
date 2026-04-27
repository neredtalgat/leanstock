import { Router } from 'express';
import * as controller from '../controllers/inventory-movement.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { injectTenant } from '../middleware/tenant';
import { listMovementsSchema } from '../schemas/inventory-movement.schema';

const router = Router();

router.get('/', authenticate, injectTenant, validate(listMovementsSchema), controller.listMovements);
router.get('/:id', authenticate, injectTenant, controller.getMovement);

export default router;
