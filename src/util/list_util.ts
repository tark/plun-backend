export const replaceWhere = <T>(
  list: Array<T>,
  condition: (o: T) => boolean,
  objectToAdd: T
): Array<T> => {
  const innerList = [...list].filter(o => !condition(o));
  innerList.push(objectToAdd)
  return innerList
}
