CREATE TABLE "minibar_standard" (
	"room" integer NOT NULL,
	"product_id" uuid NOT NULL,
	"standard_quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "minibar_standard_room_product_pk" UNIQUE("room","product_id")
);
--> statement-breakpoint
ALTER TABLE "minibar_standard" ADD CONSTRAINT "minibar_standard_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;