-- CreateEnum
CREATE TYPE "GlobalUserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');
CREATE TYPE "IdentityProvider" AS ENUM ('ORCID', 'OIDC', 'SAML');
CREATE TYPE "OidcClientType" AS ENUM ('PUBLIC', 'CONFIDENTIAL');
CREATE TYPE "OidcClientStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "global_users" (
    "id" UUID NOT NULL,
    "status" "GlobalUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "display_name" VARCHAR(200),
    "preferred_language" VARCHAR(16) NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "last_login_at" TIMESTAMPTZ(6),
    CONSTRAINT "global_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "global_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "issuer" VARCHAR(512) NOT NULL,
    "subject" VARCHAR(320) NOT NULL,
    "display_name" VARCHAR(200),
    "profile" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "last_used_at" TIMESTAMPTZ(6),
    CONSTRAINT "global_identities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verified_emails" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "verified_emails_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oidc_clients" (
    "id" UUID NOT NULL,
    "client_id" VARCHAR(128) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "client_type" "OidcClientType" NOT NULL DEFAULT 'CONFIDENTIAL',
    "client_secret_hash" VARCHAR(255),
    "redirect_uris" JSONB NOT NULL,
    "status" "OidcClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "oidc_clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "authorization_codes" (
    "id" UUID NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "client_id" VARCHAR(128) NOT NULL,
    "redirect_uri" VARCHAR(2048) NOT NULL,
    "scope" VARCHAR(512) NOT NULL,
    "nonce" VARCHAR(512),
    "code_challenge" VARCHAR(128) NOT NULL,
    "code_challenge_method" VARCHAR(16) NOT NULL DEFAULT 'S256',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "authorization_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "access_tokens" (
    "id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "client_id" VARCHAR(128) NOT NULL,
    "scope" VARCHAR(512) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "access_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "identity_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6),
    CONSTRAINT "identity_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_oauth_states" (
    "id" UUID NOT NULL,
    "state_hash" VARCHAR(64) NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "return_url" VARCHAR(2048) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "provider_oauth_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "kind" VARCHAR(128) NOT NULL,
    "data" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "global_identities_provider_issuer_subject_key" ON "global_identities"("provider", "issuer", "subject");
CREATE INDEX "global_identities_user_id_provider_idx" ON "global_identities"("user_id", "provider");
CREATE UNIQUE INDEX "verified_emails_email_key" ON "verified_emails"("email");
CREATE INDEX "verified_emails_user_id_is_primary_idx" ON "verified_emails"("user_id", "is_primary");
CREATE UNIQUE INDEX "oidc_clients_client_id_key" ON "oidc_clients"("client_id");
CREATE INDEX "oidc_clients_status_idx" ON "oidc_clients"("status");
CREATE UNIQUE INDEX "authorization_codes_code_hash_key" ON "authorization_codes"("code_hash");
CREATE INDEX "authorization_codes_client_id_expires_at_idx" ON "authorization_codes"("client_id", "expires_at");
CREATE INDEX "authorization_codes_user_id_expires_at_idx" ON "authorization_codes"("user_id", "expires_at");
CREATE UNIQUE INDEX "access_tokens_token_hash_key" ON "access_tokens"("token_hash");
CREATE INDEX "access_tokens_client_id_expires_at_idx" ON "access_tokens"("client_id", "expires_at");
CREATE INDEX "access_tokens_user_id_expires_at_idx" ON "access_tokens"("user_id", "expires_at");
CREATE UNIQUE INDEX "identity_sessions_token_hash_key" ON "identity_sessions"("token_hash");
CREATE INDEX "identity_sessions_user_id_expires_at_idx" ON "identity_sessions"("user_id", "expires_at");
CREATE INDEX "identity_sessions_expires_at_idx" ON "identity_sessions"("expires_at");
CREATE UNIQUE INDEX "provider_oauth_states_state_hash_key" ON "provider_oauth_states"("state_hash");
CREATE INDEX "provider_oauth_states_expires_at_idx" ON "provider_oauth_states"("expires_at");
CREATE INDEX "audit_events_user_id_created_at_idx" ON "audit_events"("user_id", "created_at");
CREATE INDEX "audit_events_kind_created_at_idx" ON "audit_events"("kind", "created_at");

-- AddForeignKey
ALTER TABLE "global_identities" ADD CONSTRAINT "global_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "global_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "verified_emails" ADD CONSTRAINT "verified_emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "global_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "authorization_codes" ADD CONSTRAINT "authorization_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "global_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "authorization_codes" ADD CONSTRAINT "authorization_codes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oidc_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "global_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oidc_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "identity_sessions" ADD CONSTRAINT "identity_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "global_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "global_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
