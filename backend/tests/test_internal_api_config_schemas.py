"""Tests unitarios para los schemas tipados de la configuracion de M7.
Verifican que las listas dejaron de ser objetos genericos y que aceptan las formas reales
que devuelven los clientes de JSM y de Confluence."""

from app.modules.internal_api.schemas import (
    AvailableProjectsResponse,
    CountriesResponse,
    ProjectStatusesResponse,
    SelectFieldsResponse,
    PrioritiesWithSuggestionResponse,
    AvailableSpacesResponse,
)


# verifica que los proyectos disponibles quedan tipados con key y name
def test_available_projects_are_typed():
    response = AvailableProjectsResponse(projects=[{"key": "TARG", "name": "Argentina"}])

    assert response.projects[0].key == "TARG"
    assert response.model_dump()["projects"] == [{"key": "TARG", "name": "Argentina"}]


# verifica que los paises quedan tipados con code y name
def test_countries_are_typed():
    response = CountriesResponse(countries=[{"code": "AR", "name": "Argentina"}])

    assert response.countries[0].code == "AR"


# verifica que los estados de JSM quedan tipados y que un id numerico se convierte a texto
def test_statuses_are_typed_and_numeric_id_becomes_text():
    response = ProjectStatusesResponse(statuses=[{"id": 10001, "name": "Open"}])

    assert response.statuses[0].id == "10001"


# verifica que los campos de seleccion unica quedan tipados con id y name
def test_select_fields_are_typed():
    response = SelectFieldsResponse(fields=[{"id": "customfield_10050", "name": "Categoria"}])

    assert response.fields[0].id == "customfield_10050"


# verifica que las prioridades quedan tipadas y que las sugerencias aceptan null
def test_priorities_are_typed_and_suggestions_accept_null():
    response = PrioritiesWithSuggestionResponse(
        priorities=[{"id": "1", "name": "Highest"}],
        suggestions={"Highest": "1", "High": None},
    )

    assert response.priorities[0].id == "1"
    assert response.suggestions["Highest"] == "1"
    assert response.suggestions["High"] is None


# verifica que los spaces de Confluence quedan tipados y que un id numerico se convierte a texto
def test_spaces_are_typed_and_numeric_id_becomes_text():
    response = AvailableSpacesResponse(spaces=[{"id": 123, "key": "TA", "name": "Soporte"}])

    assert response.spaces[0].id == "123"
    assert response.spaces[0].key == "TA"


# verifica que ninguna de las listas sigue siendo un objeto generico en el contrato
def test_lists_are_not_generic_objects_in_the_contract():
    expected = [
        (AvailableProjectsResponse, "projects"),
        (CountriesResponse, "countries"),
        (ProjectStatusesResponse, "statuses"),
        (SelectFieldsResponse, "fields"),
        (PrioritiesWithSuggestionResponse, "priorities"),
        (AvailableSpacesResponse, "spaces"),
    ]

    for model, field in expected:
        items = model.model_json_schema()["properties"][field]["items"]
        assert "$ref" in items, f"{model.__name__}.{field} sigue sin tipo"
