-- =====================================================================
-- BuildFlow DEMO DATA — for local development only.
-- Every business here is fictional and flagged is_demo = true.
-- All demo accounts use the password:  demo-password-123
-- Never run this file against a production database.
-- =====================================================================

-- Demo auth users ----------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@kingstonpro.demo',
   crypt('demo-password-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Marcus Reid (Demo)","account_type":"contractor"}', now(), now()),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@islandelectrical.demo',
   crypt('demo-password-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Andrea Campbell (Demo)","account_type":"contractor"}', now(), now()),
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@primetiling.demo',
   crypt('demo-password-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Devon Thompson (Demo)","account_type":"contractor"}', now(), now()),
  ('00000000-0000-4000-a000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@caribbeanroofing.demo',
   crypt('demo-password-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Shanice Brown (Demo)","account_type":"contractor"}', now(), now()),
  ('00000000-0000-4000-a000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'customer@buildflow.demo',
   crypt('demo-password-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Jordan Lewis (Demo)","account_type":"customer"}', now(), now()),
  ('00000000-0000-4000-a000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'crew@kingstonpro.demo',
   crypt('demo-password-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ricardo Gayle (Demo)","account_type":"contractor"}', now(), now()),
  ('00000000-0000-4000-a000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@buildflow.demo',
   crypt('demo-password-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Platform Admin (Demo)","account_type":"customer"}', now(), now());

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email', jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now()
  from auth.users u where u.email like '%.demo';

update public.profiles set is_platform_admin = true where id = '00000000-0000-4000-a000-000000000009';

-- Demo businesses ----------------------------------------------------
insert into public.businesses (id, owner_id, name, slug, tagline, description, phone, email, website, social_links, years_in_business,
                               country_code, region_id, city, service_area, primary_service_id, is_verified, is_demo, onboarding_step, onboarding_completed_at, cover_url, logo_url)
values
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000001', 'Kingston Pro Builders', 'kingston-pro-builders',
   'Residential builds & renovations done right, on time.',
   'DEMO BUSINESS. Kingston Pro Builders is a fictional general contractor used to demonstrate BuildFlow. We handle new homes, extensions, and full renovations across the Corporate Area.',
   '+1 876 555 0101', 'owner@kingstonpro.demo', 'https://example.com', '{"instagram":"https://instagram.com/example","facebook":"https://facebook.com/example"}', 12,
   'JM', (select id from public.locations where slug = 'kingston' and level = 'region'), 'Kingston', 'Kingston, St Andrew & St Catherine',
   (select id from public.services where slug = 'general-contractor'), true, true, 7, now(),
   'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1600&q=70', null),
  ('10000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000002', 'Island Electrical Services', 'island-electrical-services',
   'Licensed electrical installs, rewiring and solar-ready upgrades.',
   'DEMO BUSINESS. Island Electrical Services is a fictional electrician used to demonstrate BuildFlow. Residential and light-commercial wiring, panel upgrades and inspections.',
   '+1 876 555 0102', 'owner@islandelectrical.demo', null, '{"facebook":"https://facebook.com/example"}', 8,
   'JM', (select id from public.locations where slug = 'st-andrew' and level = 'region'), 'Half Way Tree', 'St Andrew & Kingston',
   (select id from public.services where slug = 'electrician'), false, true, 7, now(),
   'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1600&q=70', null),
  ('10000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000003', 'Prime Tiling & Renovation', 'prime-tiling-renovation',
   'Floors, bathrooms and kitchens with a clean finish.',
   'DEMO BUSINESS. Prime Tiling & Renovation is a fictional tiling company used to demonstrate BuildFlow. Porcelain, ceramic and natural stone installs.',
   '+1 876 555 0103', 'owner@primetiling.demo', null, '{}', 6,
   'JM', (select id from public.locations where slug = 'clarendon' and level = 'region'), 'May Pen', 'Clarendon, Manchester & St Catherine',
   (select id from public.services where slug = 'tiler'), false, true, 7, now(),
   'https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?w=1600&q=70', null),
  ('10000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000004', 'Caribbean Roofing Solutions', 'caribbean-roofing-solutions',
   'Hurricane-ready roofing, repairs and waterproofing.',
   'DEMO BUSINESS. Caribbean Roofing Solutions is a fictional roofer used to demonstrate BuildFlow. Zinc, shingle and concrete roof work across the island.',
   '+1 876 555 0104', 'owner@caribbeanroofing.demo', null, '{"instagram":"https://instagram.com/example"}', 15,
   'JM', (select id from public.locations where slug = 'st-james' and level = 'region'), 'Montego Bay', 'Island-wide',
   (select id from public.services where slug = 'roofer'), true, true, 7, now(),
   'https://images.unsplash.com/photo-1632759145351-1d592919f522?w=1600&q=70', null);

insert into public.business_members (business_id, user_id, role)
values ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000006', 'member');

insert into public.business_services (business_id, service_id)
select b.id, s.id from public.businesses b
join public.services s on s.slug = any (case b.slug
  when 'kingston-pro-builders' then array['general-contractor', 'renovation', 'mason', 'carpenter']
  when 'island-electrical-services' then array['electrician']
  when 'prime-tiling-renovation' then array['tiler', 'renovation']
  when 'caribbean-roofing-solutions' then array['roofer', 'carpenter'] end)
where b.is_demo;

-- CRM data for Kingston Pro Builders -----------------------------------
insert into public.customers (id, business_id, name, phone, email, address, city, notes, status) values
  ('20000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000001', 'Tamara Williams (Demo)', '+1 876 555 1001', 'tamara@example.com', '12 Hope Road', 'Kingston', 'Prefers WhatsApp in the evenings.', 'active'),
  ('20000000-0000-4000-a000-000000000002', '10000000-0000-4000-a000-000000000001', 'Blue Mountain Cafe Ltd (Demo)', '+1 876 555 1002', 'ops@example.com', '4 Lady Musgrave Road', 'Kingston', 'Commercial client; invoices to accounts dept.', 'active'),
  ('20000000-0000-4000-a000-000000000003', '10000000-0000-4000-a000-000000000001', 'Paul Henry (Demo)', '+1 876 555 1003', null, 'Portmore', 'St Catherine', null, 'past');

insert into public.leads (business_id, name, phone, email, location, description, service_id, status, source, estimated_value, assigned_to) values
  ('10000000-0000-4000-a000-000000000001', 'Kerry-Ann Douglas (Demo)', '+1 876 555 2001', 'kerryann@example.com', 'Barbican, St Andrew', 'Two-bedroom extension on existing house.', (select id from public.services where slug = 'general-contractor'), 'new', 'buildflow', 4200000, null),
  ('10000000-0000-4000-a000-000000000001', 'Garfield Morris (Demo)', '+1 876 555 2002', null, 'Spanish Town', 'Perimeter wall, about 60 ft.', (select id from public.services where slug = 'mason'), 'contacted', 'referral', 650000, '00000000-0000-4000-a000-000000000006'),
  ('10000000-0000-4000-a000-000000000001', 'Nadine Scott (Demo)', null, 'nadine@example.com', 'Constant Spring', 'Kitchen remodel with new cabinets.', (select id from public.services where slug = 'renovation'), 'quote_sent', 'social_media', 1800000, null),
  ('10000000-0000-4000-a000-000000000001', 'Ocean View Apartments (Demo)', '+1 876 555 2004', 'manager@example.com', 'New Kingston', 'Repaint and repair 12 units.', (select id from public.services where slug = 'painter'), 'negotiation', 'website', 3100000, null),
  ('10000000-0000-4000-a000-000000000001', 'Dwayne Clarke (Demo)', '+1 876 555 2005', null, 'Mona', 'Garage conversion.', null, 'lost', 'phone', 900000, null);

insert into public.projects (id, business_id, customer_id, name, description, location, start_date, expected_end_date, status, budget) values
  ('30000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001', 'Williams Home Extension (Demo)',
   'Add master bedroom and en-suite to rear of house.', 'Hope Road, Kingston', current_date - 30, current_date + 45, 'in_progress', 5500000),
  ('30000000-0000-4000-a000-000000000002', '10000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000002', 'Cafe Fit-out (Demo)',
   'Interior fit-out: counters, partition walls, flooring.', 'Lady Musgrave Road', current_date + 10, current_date + 40, 'upcoming', 2400000),
  ('30000000-0000-4000-a000-000000000003', '10000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000003', 'Henry Patio & Driveway (Demo)',
   'Stamped concrete driveway and covered patio.', 'Portmore', current_date - 90, current_date - 40, 'completed', 1200000);

insert into public.project_members (project_id, business_id, user_id) values
  ('30000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000006');

insert into public.tasks (business_id, project_id, title, priority, status, due_date, assigned_to) values
  ('10000000-0000-4000-a000-000000000001', '30000000-0000-4000-a000-000000000001', 'Pour foundation', 'high', 'done', current_date - 20, '00000000-0000-4000-a000-000000000006'),
  ('10000000-0000-4000-a000-000000000001', '30000000-0000-4000-a000-000000000001', 'Block work to belt course', 'high', 'in_progress', current_date + 3, '00000000-0000-4000-a000-000000000006'),
  ('10000000-0000-4000-a000-000000000001', '30000000-0000-4000-a000-000000000001', 'Order roofing materials', 'medium', 'todo', current_date + 5, '00000000-0000-4000-a000-000000000001'),
  ('10000000-0000-4000-a000-000000000001', '30000000-0000-4000-a000-000000000001', 'Confirm tile selection with client', 'low', 'todo', current_date + 12, null),
  ('10000000-0000-4000-a000-000000000001', '30000000-0000-4000-a000-000000000002', 'Site measurement', 'medium', 'todo', current_date + 7, null);

insert into public.notes (business_id, entity_type, entity_id, body, author_id) values
  ('10000000-0000-4000-a000-000000000001', 'project', '30000000-0000-4000-a000-000000000001', 'Client approved the revised window layout.', '00000000-0000-4000-a000-000000000001');

-- A little CRM data for the other demo businesses so isolation is testable.
insert into public.customers (business_id, name, phone, city) values
  ('10000000-0000-4000-a000-000000000002', 'Liguanea Plaza Mgmt (Demo)', '+1 876 555 3001', 'Kingston'),
  ('10000000-0000-4000-a000-000000000003', 'Sandra Bailey (Demo)', '+1 876 555 3002', 'May Pen'),
  ('10000000-0000-4000-a000-000000000004', 'Hillside Villas (Demo)', '+1 876 555 3003', 'Montego Bay');
insert into public.leads (business_id, name, phone, status, source, estimated_value) values
  ('10000000-0000-4000-a000-000000000002', 'Panel upgrade enquiry (Demo)', '+1 876 555 4001', 'new', 'buildflow', 350000),
  ('10000000-0000-4000-a000-000000000003', 'Bathroom retile (Demo)', '+1 876 555 4002', 'qualified', 'referral', 480000),
  ('10000000-0000-4000-a000-000000000004', 'Roof leak repair (Demo)', '+1 876 555 4003', 'new', 'phone', 220000);

-- Public posts -------------------------------------------------------
insert into public.posts (id, business_id, author_id, type, caption, project_id, service_id, location_text, created_at) values
  ('40000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000001', 'completed_project',
   'Stamped concrete driveway and covered patio finished in Portmore. Six weeks start to finish. (Demo post)', '30000000-0000-4000-a000-000000000003',
   (select id from public.services where slug = 'general-contractor'), 'Portmore, St Catherine', now() - interval '3 days'),
  ('40000000-0000-4000-a000-000000000002', '10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000001', 'work_in_progress',
   'Foundation poured on the Hope Road extension. Block work starts Monday. (Demo post)', '30000000-0000-4000-a000-000000000001',
   (select id from public.services where slug = 'general-contractor'), 'Kingston', now() - interval '1 day'),
  ('40000000-0000-4000-a000-000000000003', '10000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000002', 'service_showcase',
   'Full 200A panel upgrade with surge protection. Ready for solar. (Demo post)', null,
   (select id from public.services where slug = 'electrician'), 'Half Way Tree, St Andrew', now() - interval '2 days'),
  ('40000000-0000-4000-a000-000000000004', '10000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000003', 'before_after',
   'Bathroom transformation: old ceramic out, large-format porcelain in. (Demo post)', null,
   (select id from public.services where slug = 'tiler'), 'May Pen, Clarendon', now() - interval '5 days'),
  ('40000000-0000-4000-a000-000000000005', '10000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000004', 'completed_project',
   'New hip roof with hurricane straps, Montego Bay. (Demo post)', null,
   (select id from public.services where slug = 'roofer'), 'Montego Bay, St James', now() - interval '6 hours');

insert into public.post_media (post_id, business_id, url, label, position) values
  ('40000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000001', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=70', null, 0),
  ('40000000-0000-4000-a000-000000000002', '10000000-0000-4000-a000-000000000001', 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1200&q=70', null, 0),
  ('40000000-0000-4000-a000-000000000003', '10000000-0000-4000-a000-000000000002', 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=1200&q=70', null, 0),
  ('40000000-0000-4000-a000-000000000004', '10000000-0000-4000-a000-000000000003', 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=1200&q=70', 'before', 0),
  ('40000000-0000-4000-a000-000000000004', '10000000-0000-4000-a000-000000000003', 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=1200&q=70', 'after', 1),
  ('40000000-0000-4000-a000-000000000005', '10000000-0000-4000-a000-000000000004', 'https://images.unsplash.com/photo-1632759145351-1d592919f522?w=1200&q=70', null, 0);

-- Demo customer interactions (fire counters, analytics and notifications).
insert into public.follows (business_id, user_id) values
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000005'),
  ('10000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000005');
insert into public.likes (post_id, user_id) values
  ('40000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000005'),
  ('40000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000005');
insert into public.saves (post_id, user_id) values ('40000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000005');
insert into public.comments (post_id, user_id, body) values
  ('40000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000005', 'That driveway came out great. Do you work in Ocho Rios?');

select public.submit_quote_request('10000000-0000-4000-a000-000000000001', 'Jordan Lewis (Demo)', 'customer@buildflow.demo', null,
  (select id from public.services where slug = 'renovation'), 'Liguanea', 'Looking to renovate a small bathroom and add a walk-in shower.', 'JMD 500k - 1M', 'Within 3 months', 'quote');

insert into public.analytics_events (business_id, event_type, created_at)
select '10000000-0000-4000-a000-000000000001', 'profile_view', now() - (g || ' hours')::interval from generate_series(1, 48) g;
