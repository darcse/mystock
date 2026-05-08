export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      analyses: {
        Row: {
          id: string;
          stock_id: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          stock_id: string;
          user_id: string;
        };
        Update: {
          id?: string;
          stock_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      memos: {
        Row: {
          id: string;
          stock_id: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          stock_id: string;
          user_id: string;
        };
        Update: {
          id?: string;
          stock_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      stocks: {
        Row: {
          created_at: string;
          id: string;
          market: string;
          name: string;
          status: "holding" | "watching";
          ticker: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          market: string;
          name: string;
          status?: "holding" | "watching";
          ticker: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          market?: string;
          name?: string;
          status?: "holding" | "watching";
          ticker?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
