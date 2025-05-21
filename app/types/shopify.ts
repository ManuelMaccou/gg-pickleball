export interface ShopifyOrder {
  id: string;
  admin_graphql_api_id: string;
  app_id: string;
  discount_codes: string[];
  order_number: number;
  customer: {
    id: string;
  };
  location_id: string;
  merchant_business_entity_id: string;
}