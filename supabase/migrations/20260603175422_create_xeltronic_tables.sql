/*
  # Xeltronic Electrical Solution - Core Tables

  ## New Tables

  1. `rfq_requests` - Stores customer Request for Quote submissions
     - id (uuid, primary key)
     - name (text) - contact name
     - company (text) - company name
     - email (text)
     - phone (text)
     - country (text)
     - part_number (text)
     - quantity (integer)
     - message (text)
     - status (text) - pending, reviewed, quoted, closed
     - created_at (timestamptz)

  2. `sell_surplus_requests` - Stores supplier surplus inventory offers
     - id (uuid, primary key)
     - company (text)
     - contact_person (text)
     - email (text)
     - phone (text)
     - country (text)
     - brand (text)
     - part_numbers (text)
     - quantity (text)
     - condition (text)
     - message (text)
     - status (text) - pending, reviewed, accepted, declined
     - created_at (timestamptz)

  3. `contact_messages` - Stores general contact form messages
     - id (uuid, primary key)
     - name (text)
     - company (text)
     - email (text)
     - phone (text)
     - subject (text)
     - message (text)
     - created_at (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Public INSERT allowed (forms are public-facing)
  - SELECT restricted to authenticated users (admin access)
*/

-- RFQ Requests Table
CREATE TABLE IF NOT EXISTS rfq_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text NOT NULL DEFAULT '',
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  part_number text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rfq_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit RFQ"
  ON rfq_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view RFQ requests"
  ON rfq_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update RFQ status"
  ON rfq_requests FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Sell Surplus Requests Table
CREATE TABLE IF NOT EXISTS sell_surplus_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL DEFAULT '',
  contact_person text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  brand text NOT NULL DEFAULT '',
  part_numbers text NOT NULL DEFAULT '',
  quantity text NOT NULL DEFAULT '',
  condition text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sell_surplus_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit surplus offer"
  ON sell_surplus_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view surplus requests"
  ON sell_surplus_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update surplus status"
  ON sell_surplus_requests FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Contact Messages Table
CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text NOT NULL DEFAULT '',
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit contact message"
  ON contact_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view contact messages"
  ON contact_messages FOR SELECT
  TO authenticated
  USING (true);
