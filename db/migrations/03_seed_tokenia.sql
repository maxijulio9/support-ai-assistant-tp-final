-- paises donde opera Tokenia
INSERT INTO country (id, code, name) VALUES
    ('a1b2c3d4-0001-0000-0000-000000000001', 'AR', 'Argentina'),
    ('a1b2c3d4-0002-0000-0000-000000000002', 'BR', 'Brasil')
ON CONFLICT (code) DO NOTHING;