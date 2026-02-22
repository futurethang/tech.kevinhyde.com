#!/bin/bash

# Run Supabase migrations using the API

set -e

SUPABASE_URL="https://snfrilawqmervqtkvqnq.supabase.co"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZnJpbGF3cW1lcnZxdGt2cW5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc4NDI3NCwiZXhwIjoyMDg3MzYwMjc0fQ.m4_n1d6BF9mew7HwMQl4TXeHAGgPd2p10eRK0h_gYNw"

echo "🗄️ Running Database Migrations for Supabase project: dice-baseball"
echo ""

# Function to run SQL via REST API
run_sql() {
    local sql_file=$1
    local description=$2
    
    echo "Running: $description"
    
    # Read SQL file and escape for JSON
    sql_content=$(cat "$sql_file" | jq -Rs .)
    
    # Execute SQL via Supabase REST API
    response=$(curl -s -X POST \
        "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
        -H "apikey: ${SUPABASE_SERVICE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"query\": $sql_content}" 2>&1) || true
    
    # Check if successful (Supabase doesn't have exec_sql by default, so we'll use a different approach)
    echo "  ✓ Attempted execution"
}

# Alternative: Use psql if available
if command -v psql &> /dev/null; then
    echo "Using psql for migrations..."
    
    # Extract connection details from Supabase URL
    DB_HOST="db.snfrilawqmervqtkvqnq.supabase.co"
    DB_NAME="postgres"
    DB_USER="postgres"
    
    echo "Please enter the database password from your Supabase dashboard:"
    echo "(Found at: Settings > Database > Connection string)"
    read -s DB_PASSWORD
    
    export PGPASSWORD=$DB_PASSWORD
    
    for migration in supabase/migrations/*.sql; do
        echo "Running $(basename $migration)..."
        psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f "$migration"
        echo "  ✓ Complete"
    done
else
    echo "⚠️ psql not found. Trying alternative method..."
    
    # Use Supabase CLI if authenticated
    cd supabase
    
    if ~/.local/bin/supabase db push; then
        echo "✅ Migrations complete via Supabase CLI"
    else
        echo ""
        echo "❌ Could not run migrations automatically."
        echo ""
        echo "Please run migrations manually:"
        echo "1. Go to: https://app.supabase.com/project/snfrilawqmervqtkvqnq/sql/new"
        echo "2. Copy and paste each SQL file from supabase/migrations/ in order:"
        echo "   - 001_initial_schema.sql"
        echo "   - 002_row_level_security.sql"
        echo "   - 003_stored_procedures.sql"
        echo "3. Execute each one"
    fi
fi