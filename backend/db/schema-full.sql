--
-- PostgreSQL database dump
--

\restrict QTT1NkjigjHnLMW2etgcI579VlgDwH41x2hpDXF1YpIgYYpGye48E9u0GUsPs9h

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'assigned',
    'picked_up',
    'delivered',
    'cancelled'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'super_admin',
    'admin',
    'driver',
    'customer'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: driver_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_payments (
    id integer NOT NULL,
    office_id integer NOT NULL,
    driver_id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    note text,
    created_by integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT driver_payments_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: driver_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.driver_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: driver_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.driver_payments_id_seq OWNED BY public.driver_payments.id;


--
-- Name: offices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offices (
    id integer NOT NULL,
    name text NOT NULL,
    city text NOT NULL,
    max_drivers integer DEFAULT 5 NOT NULL,
    subscription_ends_at timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    commission_percent numeric(5,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT offices_commission_percent_check CHECK (((commission_percent >= (0)::numeric) AND (commission_percent <= (100)::numeric))),
    CONSTRAINT offices_max_drivers_check CHECK ((max_drivers >= 0))
);


--
-- Name: offices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.offices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: offices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.offices_id_seq OWNED BY public.offices.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    office_id integer NOT NULL,
    customer_id integer,
    driver_id integer,
    created_by integer NOT NULL,
    pickup_address text NOT NULL,
    dropoff_address text NOT NULL,
    contact_phone text,
    notes text,
    delivery_fee numeric(10,2) DEFAULT 0 NOT NULL,
    commission_percent numeric(5,2) NOT NULL,
    status public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_at timestamp with time zone,
    delivered_at timestamp with time zone,
    CONSTRAINT orders_commission_percent_check CHECK (((commission_percent >= (0)::numeric) AND (commission_percent <= (100)::numeric))),
    CONSTRAINT orders_delivery_fee_check CHECK ((delivery_fee >= (0)::numeric))
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    office_id integer,
    role public.user_role NOT NULL,
    full_name text NOT NULL,
    phone text NOT NULL,
    password_hash text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_check CHECK ((((role = 'super_admin'::public.user_role) AND (office_id IS NULL)) OR ((role <> 'super_admin'::public.user_role) AND (office_id IS NOT NULL))))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: driver_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_payments ALTER COLUMN id SET DEFAULT nextval('public.driver_payments_id_seq'::regclass);


--
-- Name: offices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offices ALTER COLUMN id SET DEFAULT nextval('public.offices_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: driver_payments driver_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_payments
    ADD CONSTRAINT driver_payments_pkey PRIMARY KEY (id);


--
-- Name: offices offices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offices
    ADD CONSTRAINT offices_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: driver_payments_driver_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX driver_payments_driver_idx ON public.driver_payments USING btree (driver_id);


--
-- Name: orders_office_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_office_status_idx ON public.orders USING btree (office_id, status);


--
-- Name: users_office_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_office_role_idx ON public.users USING btree (office_id, role);


--
-- Name: driver_payments driver_payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_payments
    ADD CONSTRAINT driver_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: driver_payments driver_payments_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_payments
    ADD CONSTRAINT driver_payments_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.users(id);


--
-- Name: driver_payments driver_payments_office_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_payments
    ADD CONSTRAINT driver_payments_office_id_fkey FOREIGN KEY (office_id) REFERENCES public.offices(id);


--
-- Name: orders orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(id);


--
-- Name: orders orders_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.users(id);


--
-- Name: orders orders_office_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_office_id_fkey FOREIGN KEY (office_id) REFERENCES public.offices(id);


--
-- Name: users users_office_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_office_id_fkey FOREIGN KEY (office_id) REFERENCES public.offices(id);


--
-- PostgreSQL database dump complete
--

\unrestrict QTT1NkjigjHnLMW2etgcI579VlgDwH41x2hpDXF1YpIgYYpGye48E9u0GUsPs9h

