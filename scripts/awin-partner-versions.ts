/** Version binding for the guarded AWIN multi-merchant workflow. */
import {CATALOG_CLASSIFIER_VERSION,CATALOG_NORMALIZER_VERSION} from "../server/integrations/awin/operationalCatalog";
import {SEARCH_PROJECTION_VERSION} from "../server/catalogSearchProjection/builder";
process.stdout.write(JSON.stringify({
 classifier:CATALOG_CLASSIFIER_VERSION,
 normalizer:CATALOG_NORMALIZER_VERSION,
 projection:SEARCH_PROJECTION_VERSION
})+"\n");
