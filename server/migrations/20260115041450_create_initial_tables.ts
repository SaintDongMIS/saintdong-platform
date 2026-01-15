import type { Knex } from 'knex';
import { roadConstructionTableSchema } from '../services/TableDefinitionService';

const roadConstructionFormTableName = 'RoadConstructionForm';

export async function up(knex: Knex): Promise<void> {
  // 此遷移腳本現在只負責建立 RoadConstructionForm
  const tableExists = await knex.schema.hasTable(roadConstructionFormTableName);
  if (!tableExists) {
    await knex.schema.raw(
      `CREATE TABLE ${roadConstructionFormTableName} (${roadConstructionTableSchema})`
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  // 刪除 RoadConstructionForm 表
  await knex.schema.dropTableIfExists(roadConstructionFormTableName);
}
