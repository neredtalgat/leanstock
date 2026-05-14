-- Add foreign key constraints for reorder_points
-- Relations to product and location

-- Add FK to products
ALTER TABLE "reorder_points" 
ADD CONSTRAINT "reorder_points_productId_fkey" 
FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add FK to locations
ALTER TABLE "reorder_points" 
ADD CONSTRAINT "reorder_points_locationId_fkey" 
FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
