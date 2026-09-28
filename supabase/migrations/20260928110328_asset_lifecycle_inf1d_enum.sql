-- INF-1D part A: enum value must commit before use in policies (see part B).
ALTER TYPE public.document_entity_type ADD VALUE IF NOT EXISTS 'equipment';
