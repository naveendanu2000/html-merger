-- Table: public.words

-- DROP TABLE IF EXISTS public.words;

CREATE TABLE IF NOT EXISTS public.words
(
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 ),
    word text COLLATE pg_catalog."default" NOT NULL,
    new_index bigint,
    content bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    update_type text COLLATE pg_catalog."default" NOT NULL DEFAULT 'retained'::text,
    old_index bigint,
    deleted_by bigint,
    section bigint,
    document bigint,
    merge_id bigint NOT NULL,
    CONSTRAINT words_pkey PRIMARY KEY (id),
    CONSTRAINT content_fk FOREIGN KEY (content)
        REFERENCES public.content (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT deleted_by_fk FOREIGN KEY (deleted_by)
        REFERENCES public."user" (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID,
    CONSTRAINT document_fk FOREIGN KEY (document)
        REFERENCES public.document (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID,
    CONSTRAINT section_fk FOREIGN KEY (section)
        REFERENCES public.section (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.words
    OWNER to postgres;


-- Table: public.user

-- DROP TABLE IF EXISTS public."user";

CREATE TABLE IF NOT EXISTS public."user"
(
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 ),
    name text COLLATE pg_catalog."default" NOT NULL,
    CONSTRAINT user_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public."user"
    OWNER to postgres;

-- Table: public.section

-- DROP TABLE IF EXISTS public.section;

CREATE TABLE IF NOT EXISTS public.section
(
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 ),
    document bigint NOT NULL,
    content bigint NOT NULL,
    CONSTRAINT section_pkey PRIMARY KEY (id),
    CONSTRAINT content_fk FOREIGN KEY (content)
        REFERENCES public.content (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID,
    CONSTRAINT document_fk FOREIGN KEY (document)
        REFERENCES public.document (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.section
    OWNER to postgres;


-- Table: public.document

-- DROP TABLE IF EXISTS public.document;

CREATE TABLE IF NOT EXISTS public.document
(
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 ),
    name text COLLATE pg_catalog."default" NOT NULL,
    owner bigint NOT NULL,
    contirbutors bigint[],
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT document_pkey PRIMARY KEY (id),
    CONSTRAINT owner_fk FOREIGN KEY (owner)
        REFERENCES public."user" (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.document
    OWNER to postgres;


-- Table: public.content

-- DROP TABLE IF EXISTS public.content;

CREATE TABLE IF NOT EXISTS public.content
(
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 ),
    data text COLLATE pg_catalog."default",
    contributor bigint NOT NULL,
    created_at time with time zone DEFAULT now(),
    status text COLLATE pg_catalog."default" NOT NULL DEFAULT 'pending'::text,
    CONSTRAINT content_pkey PRIMARY KEY (id),
    CONSTRAINT contributor FOREIGN KEY (contributor)
        REFERENCES public."user" (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.content
    OWNER to postgres;

INSERT INTO public.content(
	data, contributor)
	VALUES ('     <h1 align="center">HTML Test V3 - Complex Layout</h1>

<p align="justify">
    A complex paragraph combining <b>bold</b>, <i>italic</i>, <u>underline</u>, <strike>strike</strike>,
    <span style="color:blue;">colored text</span>, and <a href="#abcd">links</a> inline.
</p>

<ol>
    <li>Main Item 1
        <ul>
            <li>Sub Item 1
                <ol>
                    <li>Nested Sub Item 1.1</li>
                    <li>Nested Sub Item 1.2</li>
                </ol>
            </li>
            <li>Sub Item 2</li>
        </ul>
    </li>
    <li>Main Item 2</li>
    <li>Main Item 3
        <ul>
            <li>Sub Item 3.1</li>
        </ul>
    </li>
</ol>


<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAQAAAC1+jfqAAAAKklEQVR42mNgGAWjYBSMglEwCkb9T0YwGoaGhoZGRkYGJiYmBgYGAAAAP7gC9S4x+hAAAAAElFTkSuQmCC" 
     alt="Test Image 2" width="60" height="60">

<p align="justify">
    Final paragraph to demonstrate <b>nested formatting</b>, <i>links</i>, and <u>underlines</u> 
    inside a long block of text. Multiple <strike>strikethrough</strike> <b> elements are included too </b>.
</p>
', 3);