CREATE TYPE "public"."product_category" AS ENUM('BEVERAGE', 'MEAL');--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" "product_category" NOT NULL,
	"unit" varchar(50) DEFAULT 'un' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
